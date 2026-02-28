import { ConflictEngine } from '../conflict-engine';
import { PrismaService } from '../../../prisma.service';

describe('ConflictEngine', () => {
  let engine: ConflictEngine;
  let prisma: jest.Mocked<PrismaService>;

  const STUDIO_ID = 'studio-1';
  const WEEK_ID = 'week-1';

  function makeSession(overrides: Partial<any> = {}) {
    return {
      id: overrides.id ?? 'session-1',
      studioId: STUDIO_ID,
      weekId: WEEK_ID,
      baseInstructorId: overrides.baseInstructorId ?? 'inst-1',
      overrideInstructorId: overrides.overrideInstructorId ?? null,
      baseClassTypeId: overrides.baseClassTypeId ?? 'class-1',
      overrideClassTypeId: overrides.overrideClassTypeId ?? null,
      startDateTimeUTC:
        overrides.startDateTimeUTC ?? new Date('2026-03-03T12:00:00Z'),
      endDateTimeUTC:
        overrides.endDateTimeUTC ?? new Date('2026-03-03T12:50:00Z'),
      status: 'SCHEDULED',
      baseInstructor: overrides.baseInstructor ?? {
        id: 'inst-1',
        fullName: 'Instructor A',
      },
      overrideInstructor: overrides.overrideInstructor ?? null,
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      sessionOccurrence: { findMany: jest.fn() },
      unavailability: { findMany: jest.fn() },
      instructorSkill: { findMany: jest.fn() },
      instructor: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'inst-1', maxWeeklySlots: 15 },
          { id: 'inst-2', maxWeeklySlots: 10 },
        ]),
      },
    } as any;
    engine = new ConflictEngine(prisma);
  });

  it('returns empty array when no conflicts', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession(),
    ]);
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([
      { instructorId: 'inst-1', classTypeId: 'class-1', canTeach: true },
    ]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    expect(conflicts).toEqual([]);
  });

  it('detects UNASSIGNED as CRITICAL when no instructor', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession({ baseInstructorId: null, baseInstructor: null }),
    ]);
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('UNASSIGNED');
    expect(conflicts[0].severity).toBe('CRITICAL');
  });

  it('detects SKILL_MISMATCH as CRITICAL', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession(),
    ]);
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([]);
    // Instructor has NO skill for class-1
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    const mismatch = conflicts.find((c) => c.type === 'SKILL_MISMATCH');
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('CRITICAL');
  });

  it('detects UNAVAILABLE as CRITICAL', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession(),
    ]);
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([
      {
        instructorId: 'inst-1',
        startDateTimeUTC: new Date('2026-03-03T11:00:00Z'),
        endDateTimeUTC: new Date('2026-03-03T14:00:00Z'),
      },
    ]);
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([
      { instructorId: 'inst-1', classTypeId: 'class-1', canTeach: true },
    ]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    const unavailable = conflicts.find((c) => c.type === 'UNAVAILABLE');
    expect(unavailable).toBeDefined();
    expect(unavailable!.severity).toBe('CRITICAL');
  });

  it('detects DOUBLE_BOOKED as CRITICAL for overlapping sessions', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession({
        id: 'session-1',
        startDateTimeUTC: new Date('2026-03-03T12:00:00Z'),
        endDateTimeUTC: new Date('2026-03-03T12:50:00Z'),
      }),
      makeSession({
        id: 'session-2',
        startDateTimeUTC: new Date('2026-03-03T12:30:00Z'),
        endDateTimeUTC: new Date('2026-03-03T13:20:00Z'),
      }),
    ]);
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([
      { instructorId: 'inst-1', classTypeId: 'class-1', canTeach: true },
    ]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    const doubleBooked = conflicts.filter((c) => c.type === 'DOUBLE_BOOKED');
    expect(doubleBooked.length).toBe(2); // Both sessions flagged
    expect(doubleBooked[0].severity).toBe('CRITICAL');
  });

  it('detects MAX_LOAD_EXCEEDED as WARNING for >15 sessions', async () => {
    const sessions = Array.from({ length: 16 }, (_, i) =>
      makeSession({
        id: `session-${i}`,
        startDateTimeUTC: new Date(
          `2026-03-03T${(8 + i).toString().padStart(2, '0')}:00:00Z`,
        ),
        endDateTimeUTC: new Date(
          `2026-03-03T${(8 + i).toString().padStart(2, '0')}:50:00Z`,
        ),
      }),
    );

    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue(
      sessions,
    );
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([
      { instructorId: 'inst-1', classTypeId: 'class-1', canTeach: true },
    ]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    const loadExceeded = conflicts.filter(
      (c) => c.type === 'MAX_LOAD_EXCEEDED',
    );
    expect(loadExceeded.length).toBeGreaterThan(0);
    expect(loadExceeded[0].severity).toBe('WARNING');
  });

  it('is deterministic — same input produces same output', async () => {
    const sessionData = [makeSession()];
    const unavailData: any[] = [];
    const skillData = [
      { instructorId: 'inst-1', classTypeId: 'class-1', canTeach: true },
    ];

    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue(
      sessionData,
    );
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue(
      unavailData,
    );
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue(skillData);

    const result1 = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);

    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue(
      sessionData,
    );
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue(
      unavailData,
    );
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue(skillData);

    const result2 = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);

    expect(result1).toEqual(result2);
  });

  it('uses override instructor when set', async () => {
    (prisma.sessionOccurrence.findMany as jest.Mock).mockResolvedValue([
      makeSession({
        overrideInstructorId: 'inst-2',
        overrideInstructor: { id: 'inst-2', fullName: 'Carole' },
      }),
    ]);
    (prisma.unavailability.findMany as jest.Mock).mockResolvedValue([]);
    // Only inst-2 has the skill
    (prisma.instructorSkill.findMany as jest.Mock).mockResolvedValue([
      { instructorId: 'inst-2', classTypeId: 'class-1', canTeach: true },
    ]);

    const conflicts = await engine.evaluateWeekConflicts(STUDIO_ID, WEEK_ID);
    expect(conflicts).toEqual([]);
  });
});
