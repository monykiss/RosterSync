import { CoversService } from '../covers.service';
import { PrismaService } from '../../../prisma.service';
import { SyncService } from '../../sync/sync.service';

describe('Compatibility Resolution (via CoversService.respondToOffer)', () => {
  let service: CoversService;
  let prisma: jest.Mocked<PrismaService>;
  let syncService: jest.Mocked<SyncService>;

  const pendingOffer = {
    id: 'offer-1',
    response: 'PENDING',
    opportunity: {
      id: 'opp-1',
      requestedByUserId: 'demo-admin-user',
      session: {
        id: 'session-1',
        studioId: 'studio-1',
        status: 'COVER_PENDING',
        baseClassTypeId: 'class-booty',
        overrideClassTypeId: null,
      },
    },
  } as any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: PrismaService) => unknown) =>
        Promise.resolve(callback(prisma as any)),
      ),
      coverOffer: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      instructorSkill: {
        findUnique: jest.fn(),
      },
      compatibilityRule: {
        findMany: jest.fn(),
      },
      sessionOccurrence: {
        update: jest.fn(),
      },
      coverOpportunity: {
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'demo-carole-user' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'demo-admin-user' }),
      },
    } as any;

    const compatService = {} as any;
    syncService = {
      bulkEnqueueSessionSync: jest.fn().mockResolvedValue({}),
    } as any;
    const coverEngine = {} as any;
    const notificationsService = {
      notifyCoverAssigned: jest.fn().mockResolvedValue({ count: 1 }),
    } as any;

    service = new CoversService(
      prisma,
      compatService,
      syncService,
      coverEngine,
      notificationsService,
    );
  });

  it('keeps original class type when instructor can teach it', async () => {
    (prisma.coverOffer.findUnique as jest.Mock)
      .mockResolvedValueOnce(pendingOffer)
      .mockResolvedValueOnce({
        ...pendingOffer,
        response: 'ACCEPT',
        instructor: { fullName: 'Carole' },
        opportunity: {
          ...pendingOffer.opportunity,
          session: {
            id: 'session-1',
            studioId: 'studio-1',
            startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
            baseClassType: { name: 'Booty & Abs' },
            overrideClassType: null,
            week: { status: 'DRAFT' },
          },
        },
      });

    (prisma.instructorSkill.findUnique as jest.Mock).mockResolvedValue({
      canTeach: true,
    } as any);

    await service.respondToOffer('opp-1', 'inst-carole', {
      response: 'ACCEPT',
    } as any);

    expect(prisma.sessionOccurrence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          overrideClassTypeId: null,
        }),
      }),
    );
    expect(syncService.bulkEnqueueSessionSync).not.toHaveBeenCalled();
  });

  it('applies compatibility rule when instructor cannot teach original', async () => {
    (prisma.coverOffer.findUnique as jest.Mock)
      .mockResolvedValueOnce(pendingOffer)
      .mockResolvedValueOnce({
        ...pendingOffer,
        response: 'ACCEPT',
        instructor: { fullName: 'Carole' },
        opportunity: {
          ...pendingOffer.opportunity,
          session: {
            id: 'session-1',
            studioId: 'studio-1',
            startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
            baseClassType: { name: 'Booty & Abs' },
            overrideClassType: { name: 'Full Body' },
            week: { status: 'DRAFT' },
          },
        },
      });

    (prisma.instructorSkill.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ canTeach: true } as any);

    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rule-1',
        toClassTypeId: 'class-fullbody',
        priority: 1,
        reasonTemplate: 'Switching to Full Body',
      },
    ] as any);

    await service.respondToOffer('opp-1', 'inst-carole', {
      response: 'ACCEPT',
    } as any);

    expect(prisma.sessionOccurrence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          overrideClassTypeId: 'class-fullbody',
          overrideInstructorId: 'inst-carole',
        }),
      }),
    );
  });

  it('selects lowest priority compatibility rule first', async () => {
    (prisma.coverOffer.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        ...pendingOffer,
        opportunity: {
          ...pendingOffer.opportunity,
          session: { ...pendingOffer.opportunity.session, id: 's1' },
        },
      })
      .mockResolvedValueOnce({
        ...pendingOffer,
        response: 'ACCEPT',
        instructor: { fullName: 'Carole' },
        opportunity: {
          ...pendingOffer.opportunity,
          session: {
            id: 's1',
            studioId: 'studio-1',
            startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
            baseClassType: { name: 'Booty & Abs' },
            overrideClassType: { name: 'Full Body' },
            week: { status: 'DRAFT' },
          },
        },
      });

    (prisma.instructorSkill.findUnique as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ canTeach: true } as any);

    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'r1',
        toClassTypeId: 'class-fullbody',
        priority: 1,
        reasonTemplate: 'Rule 1',
      },
      {
        id: 'r2',
        toClassTypeId: 'class-hiit',
        priority: 2,
        reasonTemplate: 'Rule 2',
      },
    ] as any);

    await service.respondToOffer('opp-1', 'inst-2', {
      response: 'ACCEPT',
    } as any);

    expect(prisma.sessionOccurrence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          overrideClassTypeId: 'class-fullbody',
        }),
      }),
    );
  });

  it('rejects response on already-responded offer', async () => {
    (prisma.coverOffer.findUnique as jest.Mock).mockResolvedValue({
      ...pendingOffer,
      response: 'ACCEPT',
    });

    await expect(
      service.respondToOffer('opp-1', 'inst-1', { response: 'ACCEPT' } as any),
    ).rejects.toThrow('Offer already responded to');
  });
});
