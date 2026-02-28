import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma.service';
import { Prisma, WixJobType, WixJobStatus } from '@prisma/client';
import crypto from 'crypto';
import { SYNC_QUEUE_NAME, SyncJobData } from './sync.processor';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private queueAvailable = false;

  constructor(
    private prisma: PrismaService,
    @InjectQueue(SYNC_QUEUE_NAME) private syncQueue: Queue,
  ) {
    // Check if queue is connected
    this.syncQueue.client
      .then(() => {
        this.queueAvailable = true;
      })
      .catch(() => {
        this.logger.warn(
          'Redis not available — sync jobs will be DB-only (no BullMQ processing)',
        );
        this.queueAvailable = false;
      });
  }

  private buildPayloadHash(session: {
    id: string;
    startDateTimeUTC: Date;
    endDateTimeUTC: Date;
    baseClassTypeId: string;
    baseInstructorId: string | null;
    overrideClassTypeId: string | null;
    overrideInstructorId: string | null;
    overrideReason: string | null;
    baseInstructor: { fullName: string } | null;
    overrideInstructor: { fullName: string } | null;
    baseClassType: { name: string };
    overrideClassType: { name: string } | null;
  }) {
    const classTypeId = session.overrideClassTypeId || session.baseClassTypeId;
    const instructorId =
      session.overrideInstructorId || session.baseInstructorId;
    const instructor =
      instructorId === session.overrideInstructorId
        ? session.overrideInstructor
        : session.baseInstructor;
    const classType =
      classTypeId === session.overrideClassTypeId
        ? session.overrideClassType
        : session.baseClassType;

    const payload = {
      sessionId: session.id,
      startDateTimeUTC: session.startDateTimeUTC.toISOString(),
      endDateTimeUTC: session.endDateTimeUTC?.toISOString?.(),
      instructorId,
      instructorName: instructor?.fullName ?? null,
      classTypeId,
      classTypeName: classType?.name ?? null,
      reason: session.overrideReason ?? null,
    };

    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    return { payloadHash, payload, classTypeId, instructorId };
  }

  /**
   * Enqueue a BullMQ job for processing. Falls back to DB-only if Redis is unavailable.
   */
  private async enqueueToQueue(
    syncJobId: string,
    studioId: string,
    sessionId: string,
    payloadHash: string,
  ) {
    if (!this.queueAvailable) return;

    try {
      const jobData: SyncJobData = {
        syncJobId,
        studioId,
        sessionId,
        payloadHash,
        attempt: 0,
      };

      await this.syncQueue.add('sync-session', jobData, {
        jobId: syncJobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to enqueue to BullMQ: ${error}. Job ${syncJobId} remains in DB as PENDING.`,
      );
    }
  }

  async getSyncStatus(studioId: string) {
    return this.prisma.wixSyncJob.findMany({
      where: { studioId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async enqueueSessionSync(studioId: string, sessionId: string) {
    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: sessionId },
      include: {
        baseClassType: true,
        overrideClassType: true,
        baseInstructor: true,
        overrideInstructor: true,
      },
    });

    if (!session) throw new BadRequestException('Session not found');

    if (session.studioId !== studioId) {
      throw new BadRequestException('Session does not belong to studio');
    }

    const { payloadHash } = this.buildPayloadHash(session);
    const idempotencyKey = `UPSERT:${session.id}:${payloadHash}`;

    const job = await this.prisma.wixSyncJob.upsert({
      where: { idempotencyKey },
      update: {},
      create: {
        studioId,
        sessionId,
        jobType: WixJobType.UPSERT_SESSION,
        idempotencyKey,
        status: WixJobStatus.PENDING,
        attempts: 0,
      },
    });

    await this.enqueueToQueue(job.id, studioId, sessionId, payloadHash);

    return { job, message: 'Sync job enqueued' };
  }

  async bulkEnqueueSessionSync(
    studioId: string,
    sessionIds: string[],
    weekHash?: string,
    correlationId?: string,
  ) {
    if (!sessionIds?.length) {
      throw new BadRequestException('sessionIds must be a non-empty array');
    }

    const sessions = await this.prisma.sessionOccurrence.findMany({
      where: { studioId, id: { in: sessionIds } },
      include: {
        baseClassType: true,
        overrideClassType: true,
        baseInstructor: true,
        overrideInstructor: true,
      },
    });

    if (sessions.length !== sessionIds.length) {
      throw new BadRequestException('One or more sessions not found in studio');
    }

    const jobsData = sessions.map((s) => {
      const { payloadHash, payload } = this.buildPayloadHash(s);
      const scope = weekHash ? `:${weekHash}` : `:${payloadHash}`;
      return {
        studioId,
        sessionId: s.id,
        jobType: WixJobType.UPSERT_SESSION,
        idempotencyKey: `UPSERT:${s.id}${scope}`,
        status: WixJobStatus.PENDING,
        attempts: 0,
        correlationId: correlationId ?? null,
        payloadJson: payload as unknown as Prisma.InputJsonValue,
        payloadHash,
      };
    });

    const results = await this.prisma.$transaction(
      jobsData.map((job) =>
        this.prisma.wixSyncJob.upsert({
          where: { idempotencyKey: job.idempotencyKey },
          update: {},
          create: job,
        }),
      ),
    );

    // Enqueue to BullMQ after DB transaction succeeds
    for (let i = 0; i < results.length; i++) {
      await this.enqueueToQueue(
        results[i].id,
        studioId,
        results[i].sessionId ?? '',
        jobsData[i].payloadHash,
      );
    }

    return {
      enqueuedCount: results.length,
      message: 'Bulk sync jobs enqueued',
    };
  }

  async retryJob(jobId: string) {
    const existing = await this.prisma.wixSyncJob.findUnique({
      where: { id: jobId },
    });
    if (!existing) throw new BadRequestException('Job not found');

    const job = await this.prisma.wixSyncJob.update({
      where: { id: jobId },
      data: { status: WixJobStatus.PENDING, attempts: 0, lastError: null },
    });

    await this.enqueueToQueue(
      job.id,
      job.studioId,
      job.sessionId ?? '',
      job.payloadHash ?? '',
    );

    return { job, message: 'Job retried' };
  }

  async getSessionHistory(sessionId: string) {
    return this.prisma.wixSyncJob.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get queue health metrics for the sync dashboard.
   */
  async getQueueHealth() {
    if (!this.queueAvailable) {
      return {
        connected: false,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    }

    try {
      const [waiting, active, completed, failed] = await Promise.all([
        this.syncQueue.getWaitingCount(),
        this.syncQueue.getActiveCount(),
        this.syncQueue.getCompletedCount(),
        this.syncQueue.getFailedCount(),
      ]);
      return { connected: true, waiting, active, completed, failed };
    } catch {
      return {
        connected: false,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
      };
    }
  }
}
