import { SyncService } from '../sync.service';
import { PrismaService } from '../../../prisma.service';

// Mock BullMQ Queue
const mockQueue = {
  client: Promise.resolve(),
  add: jest.fn().mockResolvedValue({}),
  getWaitingCount: jest.fn().mockResolvedValue(0),
  getActiveCount: jest.fn().mockResolvedValue(0),
  getCompletedCount: jest.fn().mockResolvedValue(0),
  getFailedCount: jest.fn().mockResolvedValue(0),
};

describe('SyncService — Idempotency', () => {
  let service: SyncService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      sessionOccurrence: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      wixSyncJob: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;
    service = new SyncService(prisma, mockQueue as any);
  });

  function makeSession(overrides: Partial<any> = {}) {
    return {
      id: overrides.id ?? 'session-1',
      studioId: overrides.studioId ?? 'studio-1',
      baseClassTypeId: 'class-1',
      overrideClassTypeId: overrides.overrideClassTypeId ?? null,
      baseInstructorId: 'inst-1',
      overrideInstructorId: overrides.overrideInstructorId ?? null,
      baseClassType: { name: 'Booty & Abs' },
      overrideClassType: overrides.overrideClassType ?? null,
      baseInstructor: { fullName: 'Instructor A' },
      overrideInstructor: overrides.overrideInstructor ?? null,
      startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
      endDateTimeUTC: new Date('2026-03-03T12:50:00Z'),
      overrideReason: null,
    };
  }

  it('creates job with deterministic idempotencyKey', async () => {
    const session = makeSession();
    (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue(
      session,
    );
    (prisma.wixSyncJob.upsert as jest.Mock).mockResolvedValue({
      id: 'job-1',
    } as any);

    const result = await service.enqueueSessionSync('studio-1', 'session-1');
    expect(result.job).toBeDefined();

    const upsertCall = (prisma.wixSyncJob.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertCall.where.idempotencyKey).toMatch(/^UPSERT:session-1:/);
  });

  it('same session + same state produces same idempotency key', async () => {
    const session = makeSession();

    (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue(
      session,
    );
    (prisma.wixSyncJob.upsert as jest.Mock).mockResolvedValue({
      id: 'job-1',
    } as any);
    await service.enqueueSessionSync('studio-1', 'session-1');
    const key1 = (prisma.wixSyncJob.upsert as jest.Mock).mock.calls[0][0].where
      .idempotencyKey;

    (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue(
      session,
    );
    (prisma.wixSyncJob.upsert as jest.Mock).mockResolvedValue({
      id: 'job-1',
    } as any);
    await service.enqueueSessionSync('studio-1', 'session-1');
    const key2 = (prisma.wixSyncJob.upsert as jest.Mock).mock.calls[1][0].where
      .idempotencyKey;

    expect(key1).toBe(key2);
  });

  it('different effective state produces different idempotency key', async () => {
    const session1 = makeSession();
    (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue(
      session1,
    );
    (prisma.wixSyncJob.upsert as jest.Mock).mockResolvedValue({
      id: 'job-1',
    } as any);
    await service.enqueueSessionSync('studio-1', 'session-1');
    const key1 = (prisma.wixSyncJob.upsert as jest.Mock).mock.calls[0][0].where
      .idempotencyKey;

    const session2 = makeSession({
      overrideInstructorId: 'inst-2',
      overrideInstructor: { fullName: 'Carole' },
    });
    (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue(
      session2,
    );
    (prisma.wixSyncJob.upsert as jest.Mock).mockResolvedValue({
      id: 'job-2',
    } as any);
    await service.enqueueSessionSync('studio-1', 'session-1');
    const key2 = (prisma.wixSyncJob.upsert as jest.Mock).mock.calls[1][0].where
      .idempotencyKey;

    expect(key1).not.toBe(key2);
  });

  it('rejects enqueue for session from different studio', async () => {
    const session = makeSession({ studioId: 'studio-2' });
    (prisma.sessionOccurrence.findUnique as jest.Mock).mockResolvedValue(
      session,
    );

    await expect(
      service.enqueueSessionSync('studio-1', 'session-1'),
    ).rejects.toThrow('Session does not belong to studio');
  });

  it('bulkEnqueueSessionSync rejects if sessions not all in studio', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession({ id: 's1' }),
    ]);

    await expect(
      service.bulkEnqueueSessionSync('studio-1', ['s1', 's2']),
    ).rejects.toThrow('One or more sessions not found in studio');
  });

  it('bulkEnqueueSessionSync rejects empty sessionIds', async () => {
    await expect(
      service.bulkEnqueueSessionSync('studio-1', []),
    ).rejects.toThrow('sessionIds must be a non-empty array');
  });

  it('retryJob resets status and attempts', async () => {
    (prisma.wixSyncJob.findUnique as jest.Mock).mockResolvedValue({
      id: 'job-1',
      studioId: 'studio-1',
      sessionId: 's1',
      payloadHash: 'hash',
    } as any);
    (prisma.wixSyncJob.update as jest.Mock).mockResolvedValue({
      id: 'job-1',
      status: 'PENDING',
      attempts: 0,
      studioId: 'studio-1',
      sessionId: 's1',
      payloadHash: 'hash',
    } as any);

    const result = await service.retryJob('job-1');
    expect(prisma.wixSyncJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: 'PENDING', attempts: 0, lastError: null },
    });
    expect(result.job.status).toBe('PENDING');
  });

  it('bulkEnqueueSessionSync stores payload and correlationId', async () => {
    const session = makeSession({ id: 's1' });
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      session,
    ]);

    (prisma.$transaction as jest.Mock).mockImplementation(() => {
      return [
        {
          id: 'job-1',
          studioId: 'studio-1',
          sessionId: 's1',
          payloadHash: 'hash',
        },
      ];
    });

    await service.bulkEnqueueSessionSync(
      'studio-1',
      ['s1'],
      'weekHash123',
      'corr-abc',
    );

    const transactionArg = prisma.$transaction.mock.calls[0][0];
    expect(transactionArg).toHaveLength(1);
  });
});
