import { SessionGenerationService } from '../session-generation.service';
import { PrismaService } from '../../../prisma.service';
import { ConflictException, BadRequestException } from '@nestjs/common';

describe('SessionGenerationService', () => {
  let service: SessionGenerationService;
  let prisma: jest.Mocked<PrismaService>;

  const STUDIO_ID = 'studio-1';
  const WEEK_START = '2026-03-02T00:00:00.000Z';

  beforeEach(() => {
    prisma = {
      studio: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      week: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      recurringSlotTemplate: {
        findMany: jest.fn(),
      },
      sessionOccurrence: {
        upsert: jest.fn(),
      },
    } as any;
    service = new SessionGenerationService(prisma);
  });

  const TEMPLATE = {
    id: 'slot-1',
    studioId: STUDIO_ID,
    weekday: 1,
    startTime: '09:00',
    durationMins: 50,
    defaultClassTypeId: 'class-1',
    defaultInstructorId: 'inst-1',
    isActive: true,
  } as any;

  it('creates a new week if none exists', async () => {
    (prisma.week.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.week.create as jest.Mock).mockResolvedValue({
      id: 'week-1',
      studioId: STUDIO_ID,
      weekStartDate: new Date(WEEK_START),
      status: 'DRAFT',
    } as any);
    (prisma.recurringSlotTemplate.findMany as jest.Mock).mockResolvedValue([
      TEMPLATE,
    ]);
    (prisma.sessionOccurrence.upsert as jest.Mock).mockResolvedValue({
      id: 'session-1',
    } as any);

    const result = await service.generateWeekSessions(STUDIO_ID, WEEK_START);
    expect(prisma.week.create).toHaveBeenCalled();
    expect(result.week.id).toBe('week-1');
  });

  it('reuses existing DRAFT week without creating new', async () => {
    (prisma.week.findFirst as jest.Mock).mockResolvedValue({
      id: 'week-1',
      studioId: STUDIO_ID,
      weekStartDate: new Date(WEEK_START),
      status: 'DRAFT',
    } as any);
    (prisma.recurringSlotTemplate.findMany as jest.Mock).mockResolvedValue([
      TEMPLATE,
    ]);
    (prisma.sessionOccurrence.upsert as jest.Mock).mockResolvedValue({
      id: 'session-1',
    } as any);

    const result = await service.generateWeekSessions(STUDIO_ID, WEEK_START);
    expect(prisma.week.create).not.toHaveBeenCalled();
    expect(result.week.id).toBe('week-1');
  });

  it('throws ConflictException if week is already PUBLISHED', async () => {
    (prisma.week.findFirst as jest.Mock).mockResolvedValue({
      id: 'week-1',
      studioId: STUDIO_ID,
      weekStartDate: new Date(WEEK_START),
      status: 'PUBLISHED',
    } as any);

    await expect(
      service.generateWeekSessions(STUDIO_ID, WEEK_START),
    ).rejects.toThrow(ConflictException);
  });

  it('generates sessions from templates via upsert (idempotent)', async () => {
    (prisma.week.findFirst as jest.Mock).mockResolvedValue({
      id: 'week-1',
      studioId: STUDIO_ID,
      weekStartDate: new Date(WEEK_START),
      status: 'DRAFT',
    } as any);

    (prisma.recurringSlotTemplate.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-1',
        studioId: STUDIO_ID,
        weekday: 2,
        startTime: '08:00',
        durationMins: 50,
        defaultClassTypeId: 'class-1',
        defaultInstructorId: 'inst-1',
        isActive: true,
      } as any,
    ]);

    (prisma.sessionOccurrence.upsert as jest.Mock).mockResolvedValue({
      id: 'session-1',
    } as any);

    const result = await service.generateWeekSessions(STUDIO_ID, WEEK_START);
    expect(result.sessionsCreated).toBe(1);
    expect(prisma.sessionOccurrence.upsert).toHaveBeenCalledTimes(1);

    // Verify upsert uses unique compound key
    const upsertCall = (prisma.sessionOccurrence.upsert as jest.Mock).mock
      .calls[0][0];
    expect(upsertCall.where.slotTemplateId_startDateTimeUTC).toBeDefined();
    expect(
      upsertCall.where.slotTemplateId_startDateTimeUTC.slotTemplateId,
    ).toBe('slot-1');
  });

  it('regeneration does not overwrite existing sessions (upsert update is empty)', async () => {
    (prisma.week.findFirst as jest.Mock).mockResolvedValue({
      id: 'week-1',
      studioId: STUDIO_ID,
      weekStartDate: new Date(WEEK_START),
      status: 'DRAFT',
    } as any);

    (prisma.recurringSlotTemplate.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'slot-1',
        studioId: STUDIO_ID,
        weekday: 2,
        startTime: '08:00',
        durationMins: 50,
        defaultClassTypeId: 'class-1',
        defaultInstructorId: 'inst-1',
        isActive: true,
      } as any,
    ]);

    (prisma.sessionOccurrence.upsert as jest.Mock).mockResolvedValue({
      id: 'session-1',
    } as any);

    await service.generateWeekSessions(STUDIO_ID, WEEK_START);

    const upsertCall = (prisma.sessionOccurrence.upsert as jest.Mock).mock
      .calls[0][0];
    expect(upsertCall.update).toEqual({});
  });

  it('throws BadRequestException when no active templates', async () => {
    (prisma.week.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.week.create as jest.Mock).mockResolvedValue({
      id: 'week-1',
      studioId: STUDIO_ID,
      weekStartDate: new Date(WEEK_START),
      status: 'DRAFT',
    } as any);
    (prisma.recurringSlotTemplate.findMany as jest.Mock).mockResolvedValue([]);

    await expect(
      service.generateWeekSessions(STUDIO_ID, WEEK_START),
    ).rejects.toThrow(BadRequestException);
  });
});
