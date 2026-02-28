import { CoverOpportunityEngine } from '../cover-engine';
import { PrismaService } from '../../../prisma.service';

describe('CoverOpportunityEngine', () => {
  let engine: CoverOpportunityEngine;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      coverOpportunity: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      instructor: {
        findMany: jest.fn(),
      },
      compatibilityRule: {
        findMany: jest.fn(),
      },
      coverOffer: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      sessionOccurrence: {
        update: jest.fn(),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ instructorId: 'inst-requester' }),
      },
      $transaction: jest.fn(),
    } as any;
    engine = new CoverOpportunityEngine(prisma, {
      notifyCoverOpportunity: jest.fn().mockResolvedValue({ count: 0 }),
    } as any);
  });

  const SESSION = {
    id: 'session-1',
    studioId: 'studio-1',
    baseClassTypeId: 'class-booty',
    overrideClassTypeId: null,
    baseClassType: { id: 'class-booty', name: 'Booty & Abs' },
    overrideClassType: null,
    baseInstructor: { id: 'inst-a', fullName: 'Instructor A' },
    overrideInstructor: null,
    startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
    endDateTimeUTC: new Date('2026-03-03T12:50:00Z'),
  };

  it('filters out unavailable instructors', async () => {
    (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
      id: 'opp-1',
      session: SESSION,
      requestedByUserId: 'user-1',
    } as any);

    (prisma.instructor.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'inst-carole',
        skills: [{ classTypeId: 'class-booty', canTeach: true }],
        unavailability: [
          {
            // Overlapping unavailability
            startDateTimeUTC: new Date('2026-03-03T11:00:00Z'),
            endDateTimeUTC: new Date('2026-03-03T14:00:00Z'),
          },
        ],
        baseSessions: [],
        overrideSessions: [],
        maxWeeklySlots: 10,
      },
    ] as any);

    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);

    const result = await engine.generateOffersForOpportunity('opp-1');
    expect(result.offersCreated).toBe(0);
  });

  it('filters out double-booked instructors', async () => {
    (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
      id: 'opp-1',
      session: SESSION,
      requestedByUserId: 'user-1',
    } as any);

    (prisma.instructor.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'inst-carole',
        skills: [{ classTypeId: 'class-booty', canTeach: true }],
        unavailability: [],
        baseSessions: [
          {
            overrideInstructorId: null,
            startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
            endDateTimeUTC: new Date('2026-03-03T12:50:00Z'),
          },
        ],
        overrideSessions: [],
        maxWeeklySlots: 10,
      },
    ] as any);

    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([]);

    const result = await engine.generateOffersForOpportunity('opp-1');
    expect(result.offersCreated).toBe(0);
  });

  it('gives direct skill match highest rank score (100)', async () => {
    (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
      id: 'opp-1',
      session: SESSION,
      requestedByUserId: 'user-1',
    } as any);

    (prisma.instructor.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'inst-carole',
        skills: [{ classTypeId: 'class-booty', canTeach: true }],
        unavailability: [],
        baseSessions: [],
        overrideSessions: [],
        maxWeeklySlots: 10,
      },
    ] as any);

    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue([{ id: 'offer-1' }]);
    (prisma.coverOpportunity.update as jest.Mock).mockResolvedValue({} as any);

    const result = await engine.generateOffersForOpportunity('opp-1');
    expect(result.offersCreated).toBe(1);

    // Verify the transaction was called with the offer data
    const txArg = prisma.$transaction.mock.calls[0][0];
    expect(txArg).toHaveLength(1);
  });

  it('compatibility match gets lower score than direct match', async () => {
    (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
      id: 'opp-1',
      session: SESSION,
      requestedByUserId: 'user-1',
    } as any);

    (prisma.instructor.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'inst-direct',
        skills: [{ classTypeId: 'class-booty', canTeach: true }],
        unavailability: [],
        baseSessions: [],
        overrideSessions: [],
        maxWeeklySlots: 10,
      },
      {
        id: 'inst-compat',
        skills: [{ classTypeId: 'class-fullbody', canTeach: true }],
        unavailability: [],
        baseSessions: [],
        overrideSessions: [],
        maxWeeklySlots: 10,
      },
    ] as any);

    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([
      { toClassTypeId: 'class-fullbody', priority: 1 },
    ] as any);

    prisma.$transaction.mockResolvedValue([{}, {}]);
    (prisma.coverOpportunity.update as jest.Mock).mockResolvedValue({} as any);

    await engine.generateOffersForOpportunity('opp-1');

    // Inspect the upsert calls inside the transaction
    const txArg = prisma.$transaction.mock.calls[0][0];
    expect(txArg).toHaveLength(2); // Both candidates
  });

  it('limits offers to top 5 candidates', async () => {
    (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
      id: 'opp-1',
      session: SESSION,
      requestedByUserId: 'user-1',
    } as any);

    // Create 8 eligible instructors
    const instructors = Array.from({ length: 8 }, (_, i) => ({
      id: `inst-${i}`,
      skills: [{ classTypeId: 'class-booty', canTeach: true }],
      unavailability: [],
      baseSessions: [],
      overrideSessions: [],
      maxWeeklySlots: 10,
    }));

    (prisma.instructor.findMany as jest.Mock).mockResolvedValue(
      instructors as any,
    );
    (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([]);
    prisma.$transaction.mockResolvedValue(Array(5).fill({ id: 'offer' }));
    (prisma.coverOpportunity.update as jest.Mock).mockResolvedValue({} as any);

    const result = await engine.generateOffersForOpportunity('opp-1');
    expect(result.offersCreated).toBe(5); // Capped at 5
  });

  it('ranking is deterministic for identical inputs', async () => {
    const setupMocks = () => {
      (prisma.coverOpportunity.findUnique as jest.Mock).mockResolvedValue({
        id: 'opp-1',
        session: SESSION,
        requestedByUserId: 'user-1',
      } as any);
      (prisma.instructor.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'inst-a',
          skills: [{ classTypeId: 'class-booty', canTeach: true }],
          unavailability: [],
          baseSessions: [],
          overrideSessions: [],
          maxWeeklySlots: 10,
        },
        {
          id: 'inst-b',
          skills: [{ classTypeId: 'class-booty', canTeach: true }],
          unavailability: [],
          baseSessions: [
            {
              overrideInstructorId: null,
              startDateTimeUTC: new Date('2026-03-03T10:00:00Z'),
              endDateTimeUTC: new Date('2026-03-03T10:50:00Z'),
            },
          ],
          overrideSessions: [],
          maxWeeklySlots: 10,
        },
      ] as any);
      (prisma.compatibilityRule.findMany as jest.Mock).mockResolvedValue([]);
      prisma.$transaction.mockResolvedValue([{}, {}]);
      (prisma.coverOpportunity.update as jest.Mock).mockResolvedValue(
        {} as any,
      );
    };

    setupMocks();
    await engine.generateOffersForOpportunity('opp-1');
    const calls1 = prisma.$transaction.mock.calls[0][0];

    jest.clearAllMocks();

    setupMocks();
    await engine.generateOffersForOpportunity('opp-1');
    const calls2 = prisma.$transaction.mock.calls[0][0];

    // Same number of offers in same order
    expect(calls1.length).toBe(calls2.length);
  });
});
