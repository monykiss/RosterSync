import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma.service';
import { WixJobStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

export const SYNC_QUEUE_NAME = 'wix-sync';

export interface SyncJobData {
  syncJobId: string;
  studioId: string;
  sessionId: string;
  payloadHash: string;
  attempt: number;
}

@Processor(SYNC_QUEUE_NAME)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { syncJobId, sessionId } = job.data;
    this.logger.log(
      `Processing sync job ${syncJobId} for session ${sessionId}`,
    );

    const existingJob = await this.prisma.wixSyncJob.findUnique({
      where: { id: syncJobId },
      select: {
        status: true,
        attempts: true,
        sessionId: true,
      },
    });

    // Mark as PROCESSING
    await this.prisma.wixSyncJob.update({
      where: { id: syncJobId },
      data: {
        status: WixJobStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });

    try {
      // In STUB mode, simulate processing
      const wixMode = process.env.WIX_MODE ?? 'STUB';

      if (wixMode === 'STUB') {
        // Simulate work with small delay
        await new Promise((resolve) => setTimeout(resolve, 100));

        const failRate = Number(process.env.WIX_STUB_FAIL_RATE ?? '0');
        const shouldFail =
          process.env.WIX_STUB_FORCE_FAIL === '1' ||
          (failRate > 0 && Math.random() < failRate && job.data.attempt === 0);
        if (shouldFail) {
          throw new Error('STUB: Simulated Wix API timeout');
        }
      } else {
        // LIVE mode: actual Wix API call would go here
        // const wixClient = await this.getWixClient(studioId);
        // await wixClient.upsertSession(payload);
        this.logger.warn('LIVE mode Wix sync not yet implemented');
      }

      // Mark as SUCCEEDED
      await this.prisma.wixSyncJob.update({
        where: { id: syncJobId },
        data: {
          status: WixJobStatus.SUCCEEDED,
          lastError: null,
        },
      });

      this.logger.log(`Sync job ${syncJobId} succeeded`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.wixSyncJob.update({
        where: { id: syncJobId },
        data: {
          status: WixJobStatus.FAILED,
          lastError: errorMessage,
        },
      });

      const shouldNotifyFailure =
        existingJob?.status !== WixJobStatus.FAILED ||
        existingJob?.attempts === 0;

      if (shouldNotifyFailure) {
        const session = existingJob?.sessionId
          ? await this.prisma.sessionOccurrence.findUnique({
              where: { id: existingJob.sessionId },
              include: {
                baseClassType: true,
                overrideClassType: true,
              },
            })
          : null;

        const className =
          session?.overrideClassType?.name ||
          session?.baseClassType?.name ||
          null;

        try {
          await this.notificationsService.notifySyncFailed({
            className,
            errorMessage,
          });
        } catch (notificationError) {
          this.logger.error(
            `Failed to create sync failure notifications: ${notificationError}`,
          );
        }
      }

      this.logger.error(`Sync job ${syncJobId} failed: ${errorMessage}`);

      // Rethrow so BullMQ retries via its built-in backoff
      throw error;
    }
  }
}
