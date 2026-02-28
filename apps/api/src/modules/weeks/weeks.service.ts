import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { GenerateWeekDto } from './dto/generate-week.dto';
import { Prisma, WeekStatus } from '@prisma/client';
import { SyncService } from '../sync/sync.service';
import { ConflictEngine, SessionConflict } from './conflict-engine';
import { SessionGenerationService } from './session-generation.service';
import { TruthDerivationService } from '../sessions/services/truth-derivation.service';
import { resolveActorUserId } from '../../common/utils/actor';
import { NotificationsService } from '../notifications/notifications.service';

export interface BlockerGroup {
  type: string;
  label: string;
  description: string;
  fixHint: string;
  sessionIds: string[];
  count: number;
  examples: string[];
}

export interface PublishPrecheck {
  canPublish: boolean;
  sessionCount: number;
  criticalCount: number;
  warningCount: number;
  blockers: BlockerGroup[];
  warnings: BlockerGroup[];
  weekStatus: string;
  publishVersion: number;
  isRepublish: boolean;
}

@Injectable()
export class WeeksService {
  constructor(
    private prisma: PrismaService,
    private syncService: SyncService,
    private conflictEngine: ConflictEngine,
    private generationService: SessionGenerationService,
    private truthDerivationService: TruthDerivationService,
    private notificationsService: NotificationsService,
  ) {}

  async generateWeek(generateWeekDto: GenerateWeekDto) {
    const result = await this.generationService.generateWeekSessions(
      generateWeekDto.studioId,
      generateWeekDto.weekStartDate,
    );
    return {
      ...result.week,
      sessionsCreated: result.sessionsCreated,
    };
  }

  async getDashboardStats(studioId: string) {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const thisMonday = new Date(now);
    thisMonday.setUTCDate(thisMonday.getUTCDate() + mondayOffset);
    thisMonday.setUTCHours(0, 0, 0, 0);

    const nextMonday = new Date(thisMonday);
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);

    const [sessions, syncJobs, activeInstructors] = await Promise.all([
      this.prisma.sessionOccurrence.findMany({
        where: {
          studioId,
          startDateTimeUTC: { gte: thisMonday, lt: nextMonday },
        },
        select: {
          id: true,
          status: true,
          baseInstructorId: true,
          overrideInstructorId: true,
        },
      }),
      this.prisma.wixSyncJob.findMany({
        where: {
          studioId,
          createdAt: { gte: thisMonday },
        },
        select: { status: true },
      }),
      this.prisma.instructor.count({
        where: { studioId, isActive: true },
      }),
    ]);

    const totalSessions = sessions.length;
    const assignedSessions = sessions.filter(
      (s) =>
        s.status !== 'CANCELLED' &&
        (s.overrideInstructorId || s.baseInstructorId),
    ).length;
    const needsCover = sessions.filter(
      (s) => s.status === 'NEEDS_COVER',
    ).length;
    const cancelled = sessions.filter(
      (s) => s.status === 'CANCELLED',
    ).length;
    const fillRate =
      totalSessions > 0
        ? Math.round(
            (assignedSessions / (totalSessions - cancelled)) * 100,
          ) || 0
        : 0;

    const syncTotal = syncJobs.length;
    const syncSucceeded = syncJobs.filter(
      (j) => j.status === 'SUCCEEDED',
    ).length;
    const syncFailed = syncJobs.filter((j) => j.status === 'FAILED').length;
    const syncRate =
      syncTotal > 0 ? Math.round((syncSucceeded / syncTotal) * 100) : 100;

    return {
      totalSessions,
      fillRate,
      needsCover,
      cancelled,
      syncRate,
      syncFailed,
      activeInstructors,
    };
  }

  async findAll(studioId?: string) {
    return this.prisma.week.findMany({
      where: studioId ? { studioId } : undefined,
      include: { studio: { select: { id: true, name: true, timezone: true } } },
      orderBy: { weekStartDate: 'desc' },
      take: 20,
    });
  }

  async getPlanner(weekId: string) {
    const week = await this.prisma.week.findUnique({
      where: { id: weekId },
      include: {
        sessions: {
          include: {
            baseClassType: true,
            baseInstructor: true,
            overrideClassType: true,
            overrideInstructor: true,
            coverOpportunity: true,
          },
          orderBy: { startDateTimeUTC: 'asc' },
        },
        studio: true,
      },
    });

    if (!week) throw new NotFoundException('Week not found');

    const conflicts = await this.conflictEngine.evaluateWeekConflicts(
      week.studioId,
      weekId,
    );

    const syncHistories = await this.prisma.wixSyncJob.findMany({
      where: {
        studioId: week.studioId,
        sessionId: { in: week.sessions.map((s) => s.id) },
      },
      orderBy: { createdAt: 'desc' },
      distinct: ['sessionId'],
    });

    const syncStatusMap = new Map<string, (typeof syncHistories)[number]>();
    for (const sh of syncHistories) {
      if (sh.sessionId) syncStatusMap.set(sh.sessionId, sh);
    }

    const sessionsWithStatus = week.sessions.map((s) => ({
      ...s,
      syncStatus: syncStatusMap.get(s.id) || null,
    }));

    return {
      ...week,
      sessions: sessionsWithStatus,
      conflicts,
    };
  }

  async prepublishCheck(weekId: string): Promise<PublishPrecheck> {
    const week = await this.prisma.week.findUnique({
      where: { id: weekId },
      include: {
        sessions: {
          include: { baseClassType: true, baseInstructor: true },
        },
      },
    });
    if (!week) throw new NotFoundException('Week not found');

    const conflicts = await this.conflictEngine.evaluateWeekConflicts(
      week.studioId,
      weekId,
    );

    const sessionNameMap = new Map(
      week.sessions.map((s) => [
        s.id,
        `${s.baseClassType?.name ?? 'Class'} — ${s.baseInstructor?.fullName ?? 'Unassigned'}`,
      ]),
    );

    const grouped = this.groupConflicts(conflicts, sessionNameMap);

    const criticals = conflicts.filter((c) => c.severity === 'CRITICAL');
    const warns = conflicts.filter((c) => c.severity === 'WARNING');

    return {
      canPublish: criticals.length === 0,
      sessionCount: week.sessions.length,
      criticalCount: criticals.length,
      warningCount: warns.length,
      blockers: grouped.filter((g) => criticals.some((c) => c.type === g.type)),
      warnings: grouped.filter((g) => warns.some((c) => c.type === g.type)),
      weekStatus: week.status,
      publishVersion: week.publishVersion,
      isRepublish: week.status === WeekStatus.PUBLISHED,
    };
  }

  private groupConflicts(
    conflicts: SessionConflict[],
    sessionNameMap: Map<string, string>,
  ): BlockerGroup[] {
    const FIX_HINTS: Record<
      string,
      { label: string; description: string; fixHint: string }
    > = {
      UNASSIGNED: {
        label: 'Unassigned Sessions',
        description: 'Sessions with no instructor assigned',
        fixHint: 'Open the session and assign an instructor',
      },
      SKILL_MISMATCH: {
        label: 'Skill Mismatches',
        description: 'Instructor cannot teach the assigned class type',
        fixHint: 'Reassign the instructor or add the skill qualification',
      },
      UNAVAILABLE: {
        label: 'Unavailable Instructors',
        description: 'Instructor is marked unavailable during session time',
        fixHint:
          'Reassign to an available instructor or remove the unavailability',
      },
      DOUBLE_BOOKED: {
        label: 'Double Bookings',
        description: 'Instructor is assigned to overlapping sessions',
        fixHint:
          'Reassign one of the overlapping sessions to a different instructor',
      },
      MAX_LOAD_EXCEEDED: {
        label: 'Max Load Exceeded',
        description: 'Instructor exceeds weekly slot limit',
        fixHint:
          'Redistribute sessions or increase the instructor weekly limit',
      },
    };

    const byType = new Map<string, SessionConflict[]>();
    for (const c of conflicts) {
      const group = byType.get(c.type) ?? [];
      group.push(c);
      byType.set(c.type, group);
    }

    const groups: BlockerGroup[] = [];
    for (const [type, items] of byType) {
      const config = FIX_HINTS[type] ?? {
        label: type,
        description: '',
        fixHint: 'Review and fix the affected sessions',
      };
      const sessionIds = [...new Set(items.map((i) => i.sessionId))];
      groups.push({
        type,
        label: config.label,
        description: config.description,
        fixHint: config.fixHint,
        sessionIds,
        count: items.length,
        examples: sessionIds
          .slice(0, 3)
          .map((id) => sessionNameMap.get(id) ?? id),
      });
    }
    return groups;
  }

  async publish(
    weekId: string,
    userId: string,
    correlationId?: string,
    force = false,
  ) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);
    const week = await this.prisma.week.findUnique({
      where: { id: weekId },
      include: { sessions: true },
    });
    if (!week) throw new NotFoundException('Week not found');

    // Check for blockages (skip if force-publishing)
    const conflicts = await this.conflictEngine.evaluateWeekConflicts(
      week.studioId,
      weekId,
    );
    const criticalConflicts = conflicts.filter(
      (c) => c.severity === 'CRITICAL',
    );

    if (criticalConflicts.length > 0 && !force) {
      throw new BadRequestException({
        message: 'Cannot publish week with critical conflicts.',
        conflicts: criticalConflicts,
      });
    }

    // Derive truth and compute hash
    const { weekHash, effectiveSessions } =
      await this.truthDerivationService.deriveEffectiveSchedule(
        week.studioId,
        weekId,
      );

    // Idempotency check — same hash means same effective state
    if (week.status === WeekStatus.PUBLISHED && week.weekHash === weekHash) {
      return { message: 'Already published with latest state', week };
    }

    const newVersion = week.publishVersion + 1;

    const updatedWeek = await this.prisma.week.update({
      where: { id: weekId },
      data: {
        status: WeekStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: actorUserId,
        publishVersion: newVersion,
        weekHash,
      },
    });

    // Create immutable PublishSnapshot
    await this.prisma.publishSnapshot.create({
      data: {
        studioId: week.studioId,
        weekId,
        publishVersion: newVersion,
        weekHash,
        effectiveJson: effectiveSessions as unknown as Prisma.InputJsonValue,
        publishedBy: actorUserId,
        correlationId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        studioId: week.studioId,
        actorUserId,
        entityType: 'Week',
        entityId: weekId,
        action: 'PUBLISH_WEEK',
        reason: force
          ? `Force Publish v${newVersion} (${criticalConflicts.length} blockers overridden)`
          : `Publish v${newVersion}`,
        correlationId,
        afterJson: {
          publishVersion: newVersion,
          weekHash,
          sessionCount: week.sessions.length,
        },
      },
    });

    // Enqueue bulk sync
    const sessionIds = week.sessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      try {
        await this.syncService.bulkEnqueueSessionSync(
          week.studioId,
          sessionIds,
          weekHash,
          correlationId,
        );
      } catch (err) {
        console.error('Failed to enqueue sync jobs during publish', err);
      }
    }

    try {
      await this.notificationsService.notifyWeekPublished({
        weekStartDate: week.weekStartDate,
        publishVersion: newVersion,
      });
    } catch (err) {
      console.error('Failed to create publish notifications', err);
    }

    return updatedWeek;
  }

  async getVersionHistory(weekId: string) {
    const snapshots = await this.prisma.publishSnapshot.findMany({
      where: { weekId },
      orderBy: { publishVersion: 'desc' },
      select: {
        id: true,
        publishVersion: true,
        weekHash: true,
        publishedBy: true,
        publishedAt: true,
      },
    });
    return snapshots;
  }

  async getVersionDiff(weekId: string, version: number) {
    const snapshot = await this.prisma.publishSnapshot.findFirst({
      where: { weekId, publishVersion: version },
    });
    if (!snapshot) {
      throw new NotFoundException(`Snapshot v${version} not found`);
    }

    const currentEffective =
      await this.truthDerivationService.deriveEffectiveSchedule(
        snapshot.studioId,
        weekId,
      );

    const published = snapshot.effectiveJson as unknown as Array<{
      id: string;
      effectiveInstructorId: string;
      effectiveClassTypeId: string;
      reason: string;
    }>;

    const publishedMap = new Map(published.map((s) => [s.id, s]));
    const currentMap = new Map<string, Record<string, unknown>>(
      currentEffective.effectiveSessions.map((s: Record<string, unknown>) => [
        s.id as string,
        s,
      ]),
    );

    const changes: Array<{
      sessionId: string;
      changeType: 'added' | 'removed' | 'modified' | 'unchanged';
      fields?: string[];
    }> = [];

    // Sessions in current but not published → added
    for (const [id] of currentMap) {
      if (!publishedMap.has(id)) {
        changes.push({ sessionId: id, changeType: 'added' });
      }
    }

    // Sessions in published but not current → removed
    for (const [id] of publishedMap) {
      if (!currentMap.has(id)) {
        changes.push({ sessionId: id, changeType: 'removed' });
      }
    }

    // Sessions in both → check for modifications
    for (const [id, pub] of publishedMap) {
      const cur = currentMap.get(id) as Record<string, unknown> | undefined;
      if (!cur) continue;

      const changedFields: string[] = [];
      if (pub.effectiveInstructorId !== cur.effectiveInstructorId)
        changedFields.push('instructor');
      if (pub.effectiveClassTypeId !== cur.effectiveClassTypeId)
        changedFields.push('classType');
      if (pub.reason !== cur.reason) changedFields.push('reason');

      changes.push({
        sessionId: id,
        changeType: changedFields.length > 0 ? 'modified' : 'unchanged',
        fields: changedFields.length > 0 ? changedFields : undefined,
      });
    }

    return {
      publishVersion: version,
      publishedAt: snapshot.publishedAt,
      totalSessions: currentMap.size,
      added: changes.filter((c) => c.changeType === 'added').length,
      removed: changes.filter((c) => c.changeType === 'removed').length,
      modified: changes.filter((c) => c.changeType === 'modified').length,
      unchanged: changes.filter((c) => c.changeType === 'unchanged').length,
      changes,
    };
  }
}
