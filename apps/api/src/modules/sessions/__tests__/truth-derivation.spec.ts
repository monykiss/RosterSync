import { TruthDerivationService } from '../services/truth-derivation.service';
import { PrismaService } from '../../../prisma.service';
import * as crypto from 'crypto';

describe('TruthDerivationService', () => {
  let service: TruthDerivationService;
  let prisma: jest.Mocked<PrismaService>;

  const STUDIO_ID = 'studio-1';
  const WEEK_ID = 'week-1';

  function makeWeek(sessions: any[]) {
    return {
      id: WEEK_ID,
      studioId: STUDIO_ID,
      sessions,
    };
  }

  function makeSession(overrides: Partial<any> = {}) {
    return {
      id: overrides.id ?? 'session-1',
      startDateTimeUTC:
        overrides.startDateTimeUTC ?? new Date('2026-03-03T12:00:00Z'),
      endDateTimeUTC:
        overrides.endDateTimeUTC ?? new Date('2026-03-03T12:50:00Z'),
      baseInstructorId: overrides.baseInstructorId ?? 'inst-1',
      overrideInstructorId: overrides.overrideInstructorId ?? null,
      baseClassTypeId: overrides.baseClassTypeId ?? 'class-1',
      overrideClassTypeId: overrides.overrideClassTypeId ?? null,
      baseInstructor: overrides.baseInstructor ?? {
        id: 'inst-1',
        fullName: 'Instructor A',
      },
      overrideInstructor: overrides.overrideInstructor ?? null,
      baseClassType: overrides.baseClassType ?? {
        id: 'class-1',
        name: 'Booty & Abs',
      },
      overrideClassType: overrides.overrideClassType ?? null,
      coverOpportunity: overrides.coverOpportunity ?? null,
    };
  }

  beforeEach(() => {
    prisma = {
      week: { findUnique: jest.fn() },
    } as any;
    service = new TruthDerivationService(prisma);
  });

  it('produces deterministic weekHash for same data', async () => {
    const week = makeWeek([makeSession()]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);

    const result1 = await service.deriveEffectiveSchedule(STUDIO_ID, WEEK_ID);

    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);
    const result2 = await service.deriveEffectiveSchedule(STUDIO_ID, WEEK_ID);

    expect(result1.weekHash).toBe(result2.weekHash);
    expect(result1.weekHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
  });

  it('uses override fields when set (override ?? base precedence)', async () => {
    const week = makeWeek([
      makeSession({
        overrideInstructorId: 'inst-2',
        overrideClassTypeId: 'class-2',
        overrideInstructor: { id: 'inst-2', fullName: 'Carole' },
        overrideClassType: { id: 'class-2', name: 'Full Body' },
      }),
    ]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);

    const { effectiveSessions } = await service.deriveEffectiveSchedule(
      STUDIO_ID,
      WEEK_ID,
    );

    expect(effectiveSessions[0].effectiveInstructorId).toBe('inst-2');
    expect(effectiveSessions[0].effectiveClassTypeId).toBe('class-2');
  });

  it('falls back to base fields when no override', async () => {
    const week = makeWeek([makeSession()]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);

    const { effectiveSessions } = await service.deriveEffectiveSchedule(
      STUDIO_ID,
      WEEK_ID,
    );

    expect(effectiveSessions[0].effectiveInstructorId).toBe('inst-1');
    expect(effectiveSessions[0].effectiveClassTypeId).toBe('class-1');
    expect(effectiveSessions[0].reason).toBe('Default Schedule');
  });

  it('reason is "Cover Accepted" when override from cover', async () => {
    const week = makeWeek([
      makeSession({
        overrideInstructorId: 'inst-2',
        coverOpportunity: { status: 'ASSIGNED', offers: [] },
      }),
    ]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);

    const { effectiveSessions } = await service.deriveEffectiveSchedule(
      STUDIO_ID,
      WEEK_ID,
    );
    expect(effectiveSessions[0].reason).toBe('Cover Accepted');
  });

  it('reason is "Admin Override" when override without cover', async () => {
    const week = makeWeek([
      makeSession({
        overrideInstructorId: 'inst-2',
        coverOpportunity: null,
      }),
    ]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);

    const { effectiveSessions } = await service.deriveEffectiveSchedule(
      STUDIO_ID,
      WEEK_ID,
    );
    expect(effectiveSessions[0].reason).toBe('Admin Override');
  });

  it('different effective state produces different weekHash', async () => {
    const week1 = makeWeek([makeSession()]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week1);
    const { weekHash: hash1 } = await service.deriveEffectiveSchedule(
      STUDIO_ID,
      WEEK_ID,
    );

    const week2 = makeWeek([makeSession({ overrideInstructorId: 'inst-2' })]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week2);
    const { weekHash: hash2 } = await service.deriveEffectiveSchedule(
      STUDIO_ID,
      WEEK_ID,
    );

    expect(hash1).not.toBe(hash2);
  });

  it('empty week produces consistent hash', async () => {
    const week = makeWeek([]);
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(week);

    const { weekHash, effectiveSessions } =
      await service.deriveEffectiveSchedule(STUDIO_ID, WEEK_ID);
    expect(effectiveSessions).toEqual([]);
    expect(weekHash).toBe(
      crypto.createHash('sha256').update('[]').digest('hex'),
    );
  });

  it('throws when week not found', async () => {
    (prisma.week.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      service.deriveEffectiveSchedule(STUDIO_ID, WEEK_ID),
    ).rejects.toThrow('Week not found');
  });
});
