import { WeeksService } from '../weeks.service';
import { PrismaService } from '../../../prisma.service';
import { SyncService } from '../../sync/sync.service';
import { ConflictEngine } from '../conflict-engine';
import { SessionGenerationService } from '../session-generation.service';
import { TruthDerivationService } from '../../sessions/services/truth-derivation.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';

describe('WeeksService — Publish Flow', () => {
  let service: WeeksService;
  let prisma: jest.Mocked<PrismaService>;
  let syncService: jest.Mocked<SyncService>;
  let conflictEngine: jest.Mocked<ConflictEngine>;
  let generationService: jest.Mocked<SessionGenerationService>;
  let truthService: jest.Mocked<TruthDerivationService>;
  let notificationsService: jest.Mocked<NotificationsService>;

  const WEEK_ID = 'week-1';
  const USER_ID = 'user-1';
  const STUDIO_ID = 'studio-1';
  const WEEK_HASH = 'abc123def456';
  const WEEK_START = new Date('2026-03-02T00:00:00.000Z');

  beforeEach(() => {
    prisma = {
      week: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      publishSnapshot: { create: jest.fn() },
    } as any;

    syncService = {
      bulkEnqueueSessionSync: jest.fn().mockResolvedValue({ enqueuedCount: 1 }),
    } as any;

    conflictEngine = {
      evaluateWeekConflicts: jest.fn(),
    } as any;

    generationService = {} as any;

    truthService = {
      deriveEffectiveSchedule: jest.fn(),
    } as any;

    notificationsService = {
      notifyWeekPublished: jest.fn().mockResolvedValue({ count: 2 }),
    } as any;

    service = new WeeksService(
      prisma,
      syncService,
      conflictEngine,
      generationService,
      truthService,
      notificationsService,
    );
  });

  it('blocks publish when CRITICAL conflicts exist', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'DRAFT',
      sessions: [],
      publishVersion: 0,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([
      {
        sessionId: 's1',
        type: 'UNASSIGNED',
        message: 'No instructor',
        severity: 'CRITICAL',
      },
    ]);

    await expect(service.publish(WEEK_ID, USER_ID)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('succeeds when no CRITICAL conflicts', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'DRAFT',
      sessions: [{ id: 's1' }],
      publishVersion: 0,
      weekHash: null,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([]);
    truthService.deriveEffectiveSchedule.mockResolvedValue({
      weekHash: WEEK_HASH,
      effectiveSessions: [{ id: 's1', reason: 'Default Schedule' }],
    } as any);

    (prisma.week.update as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      status: 'PUBLISHED',
      publishVersion: 1,
    } as any);
    (prisma.publishSnapshot.create as jest.Mock).mockResolvedValue({} as any);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({} as any);

    const result = await service.publish(WEEK_ID, USER_ID);
    expect((result as any).status).toBe('PUBLISHED');
    expect(prisma.week.update).toHaveBeenCalled();
    expect(notificationsService.notifyWeekPublished).toHaveBeenCalledWith({
      weekStartDate: WEEK_START,
      publishVersion: 1,
    });
  });

  it('returns existing version on double publish (same hash)', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'PUBLISHED',
      sessions: [{ id: 's1' }],
      publishVersion: 1,
      weekHash: WEEK_HASH,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([]);
    truthService.deriveEffectiveSchedule.mockResolvedValue({
      weekHash: WEEK_HASH,
      effectiveSessions: [],
    } as any);

    const result = await service.publish(WEEK_ID, USER_ID);
    expect((result as any).message).toBe('Already published with latest state');
    expect(prisma.week.update).not.toHaveBeenCalled();
  });

  it('creates audit log entry on publish', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'DRAFT',
      sessions: [],
      publishVersion: 0,
      weekHash: null,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([]);
    truthService.deriveEffectiveSchedule.mockResolvedValue({
      weekHash: WEEK_HASH,
      effectiveSessions: [],
    } as any);

    (prisma.week.update as jest.Mock).mockResolvedValue({ id: WEEK_ID } as any);
    (prisma.publishSnapshot.create as jest.Mock).mockResolvedValue({} as any);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({} as any);

    await service.publish(WEEK_ID, USER_ID);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PUBLISH_WEEK',
          actorUserId: USER_ID,
        }),
      }),
    );
  });

  it('creates immutable PublishSnapshot on publish', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'DRAFT',
      sessions: [{ id: 's1' }],
      publishVersion: 0,
      weekHash: null,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([]);
    truthService.deriveEffectiveSchedule.mockResolvedValue({
      weekHash: WEEK_HASH,
      effectiveSessions: [{ id: 's1' }],
    } as any);

    (prisma.week.update as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      publishVersion: 1,
    } as any);
    (prisma.publishSnapshot.create as jest.Mock).mockResolvedValue({} as any);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({} as any);

    await service.publish(WEEK_ID, USER_ID, 'corr-123');

    expect(prisma.publishSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          weekId: WEEK_ID,
          publishVersion: 1,
          weekHash: WEEK_HASH,
          correlationId: 'corr-123',
        }),
      }),
    );
  });

  it('enqueues sync jobs for all sessions on publish', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'DRAFT',
      sessions: [{ id: 's1' }, { id: 's2' }],
      publishVersion: 0,
      weekHash: null,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([]);
    truthService.deriveEffectiveSchedule.mockResolvedValue({
      weekHash: WEEK_HASH,
      effectiveSessions: [],
    } as any);

    (prisma.week.update as jest.Mock).mockResolvedValue({ id: WEEK_ID } as any);
    (prisma.publishSnapshot.create as jest.Mock).mockResolvedValue({} as any);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({} as any);

    await service.publish(WEEK_ID, USER_ID);

    expect(syncService.bulkEnqueueSessionSync).toHaveBeenCalledWith(
      STUDIO_ID,
      ['s1', 's2'],
      WEEK_HASH,
      undefined,
    );
  });

  it('allows publish with WARNING-only conflicts', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      studioId: STUDIO_ID,
      status: 'DRAFT',
      sessions: [],
      publishVersion: 0,
      weekHash: null,
      weekStartDate: WEEK_START,
    } as any);

    conflictEngine.evaluateWeekConflicts.mockResolvedValue([
      {
        sessionId: 's1',
        type: 'MAX_LOAD_EXCEEDED',
        message: 'High load',
        severity: 'WARNING',
      },
    ]);
    truthService.deriveEffectiveSchedule.mockResolvedValue({
      weekHash: WEEK_HASH,
      effectiveSessions: [],
    } as any);

    (prisma.week.update as jest.Mock).mockResolvedValue({
      id: WEEK_ID,
      status: 'PUBLISHED',
    } as any);
    (prisma.publishSnapshot.create as jest.Mock).mockResolvedValue({} as any);
    (prisma.auditLog.create as jest.Mock).mockResolvedValue({} as any);

    const result = await service.publish(WEEK_ID, USER_ID);
    expect((result as any).status).toBe('PUBLISHED');
  });
});
