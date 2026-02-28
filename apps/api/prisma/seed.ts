import {
  PrismaClient,
  Role,
  SessionStatus,
  UnavailabilityType,
  OfferResponse,
  OpportunityStatus,
  WeekStatus,
  WixJobStatus,
  WixJobType,
  WixMode,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function sha256(input: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

async function resolveCompatibleClassType(params: {
  studioId: string;
  currentClassTypeId: string;
  instructorId: string;
}) {
  const { studioId, currentClassTypeId, instructorId } = params;

  const directSkill = await prisma.instructorSkill.findUnique({
    where: {
      instructorId_classTypeId: {
        instructorId,
        classTypeId: currentClassTypeId,
      },
    },
  });

  if (directSkill?.canTeach) {
    return {
      resolvedClassTypeId: currentClassTypeId,
      reason: 'Instructor can teach original class type.',
    };
  }

  const rules = await prisma.compatibilityRule.findMany({
    where: {
      studioId,
      fromClassTypeId: currentClassTypeId,
      isEnabled: true,
    },
    orderBy: { priority: 'asc' },
  });

  for (const rule of rules) {
    const compatibleSkill = await prisma.instructorSkill.findUnique({
      where: {
        instructorId_classTypeId: {
          instructorId,
          classTypeId: rule.toClassTypeId,
        },
      },
    });

    if (compatibleSkill?.canTeach) {
      return {
        resolvedClassTypeId: rule.toClassTypeId,
        reason:
          rule.reasonTemplate ||
          `Applied compatibility rule priority=${rule.priority}.`,
      };
    }
  }

  return {
    resolvedClassTypeId: currentClassTypeId,
    reason:
      'No compatible class type found. Keeping original class type for scheduler review.',
  };
}

async function buildWeekHash(weekId: string) {
  const sessions = await prisma.sessionOccurrence.findMany({
    where: { weekId },
    include: {
      baseClassType: true,
      overrideClassType: true,
      baseInstructor: true,
      overrideInstructor: true,
    },
    orderBy: { startDateTimeUTC: 'asc' },
  });

  const effectiveSessions = sessions.map((session) => ({
    id: session.id,
    startDateTimeUTC: session.startDateTimeUTC.toISOString(),
    endDateTimeUTC: session.endDateTimeUTC.toISOString(),
    effectiveInstructorId:
      session.overrideInstructorId || session.baseInstructorId,
    effectiveInstructorName:
      session.overrideInstructor?.fullName ||
      session.baseInstructor?.fullName ||
      'Unassigned',
    effectiveClassTypeId: session.overrideClassTypeId || session.baseClassTypeId,
    effectiveClassTypeName:
      session.overrideClassType?.name || session.baseClassType.name,
    reason: session.overrideReason || 'Default Schedule',
    status: session.status,
  }));

  return {
    weekHash: sha256(effectiveSessions),
    effectiveSessions,
  };
}

async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.publishSnapshot.deleteMany();
  await prisma.wixSyncJob.deleteMany();
  await prisma.wixIntegration.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.coverOffer.deleteMany();
  await prisma.coverOpportunity.deleteMany();
  await prisma.unavailability.deleteMany();
  await prisma.sessionOccurrence.deleteMany();
  await prisma.week.deleteMany();
  await prisma.recurringSlotTemplate.deleteMany();
  await prisma.compatibilityRule.deleteMany();
  await prisma.instructorSkill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.instructor.deleteMany();
  await prisma.classType.deleteMany();
  await prisma.studio.deleteMany();
}

async function main() {
  await resetDatabase();

  const studioA = await prisma.studio.create({
    data: {
      name: 'Studio A - Downtown',
      timezone: 'America/Puerto_Rico',
    },
  });
  const studioB = await prisma.studio.create({
    data: {
      name: 'Studio B - Uptown',
      timezone: 'America/Puerto_Rico',
    },
  });

  await prisma.wixIntegration.createMany({
    data: [
      { studioId: studioA.id, mode: WixMode.STUB },
      { studioId: studioB.id, mode: WixMode.STUB },
    ],
  });

  const classTypeNames = [
    'Booty & Abs',
    'Full Body',
    'HIIT',
    'Mobility',
    'Yoga',
    'Pilates',
    'Strength',
  ];

  const classTypes = await Promise.all(
    classTypeNames.map((name) =>
      prisma.classType.create({
        data: {
          studioId: studioA.id,
          name,
          tags: [],
          isActive: true,
        },
      }),
    ),
  );

  const classTypeByName = Object.fromEntries(
    classTypes.map((classType) => [classType.name, classType]),
  );

  await prisma.classType.create({
    data: {
      studioId: studioB.id,
      name: 'Studio B Intro',
      tags: [],
      isActive: true,
    },
  });

  await prisma.compatibilityRule.create({
    data: {
      studioId: studioA.id,
      fromClassTypeId: classTypeByName['Booty & Abs'].id,
      toClassTypeId: classTypeByName['Full Body'].id,
      priority: 1,
      isEnabled: true,
      reasonTemplate:
        'Cover instructor cannot teach Booty & Abs. Switching this session to Full Body.',
    },
  });

  const instructorA = await prisma.instructor.create({
    data: {
      studioId: studioA.id,
      fullName: 'Instructor A',
      email: 'instructora@rostersyncos.io',
      isActive: true,
      maxWeeklySlots: 8,
    },
  });
  const carole = await prisma.instructor.create({
    data: {
      studioId: studioA.id,
      fullName: 'Carole',
      email: 'carole@rostersyncos.io',
      isActive: true,
      maxWeeklySlots: 6,
    },
  });
  const dave = await prisma.instructor.create({
    data: {
      studioId: studioA.id,
      fullName: 'Dave',
      email: 'dave@rostersyncos.io',
      isActive: true,
      maxWeeklySlots: 10,
    },
  });
  const emily = await prisma.instructor.create({
    data: {
      studioId: studioA.id,
      fullName: 'Emily',
      email: 'emily@rostersyncos.io',
      isActive: true,
      maxWeeklySlots: 8,
    },
  });
  await prisma.instructor.create({
    data: {
      studioId: studioB.id,
      fullName: 'Studio B Instructor',
      email: 'studio-b@rostersyncos.io',
      isActive: true,
      maxWeeklySlots: 6,
    },
  });

  await prisma.instructorSkill.createMany({
    data: [
      {
        instructorId: instructorA.id,
        classTypeId: classTypeByName['Booty & Abs'].id,
        canTeach: true,
      },
      {
        instructorId: instructorA.id,
        classTypeId: classTypeByName['Full Body'].id,
        canTeach: true,
      },
      {
        instructorId: dave.id,
        classTypeId: classTypeByName.HIIT.id,
        canTeach: true,
      },
      {
        instructorId: dave.id,
        classTypeId: classTypeByName.Strength.id,
        canTeach: true,
      },
      {
        instructorId: dave.id,
        classTypeId: classTypeByName['Full Body'].id,
        canTeach: true,
      },
      {
        instructorId: emily.id,
        classTypeId: classTypeByName.Yoga.id,
        canTeach: true,
      },
      {
        instructorId: emily.id,
        classTypeId: classTypeByName.Mobility.id,
        canTeach: true,
      },
      {
        instructorId: carole.id,
        classTypeId: classTypeByName['Booty & Abs'].id,
        canTeach: false,
      },
      {
        instructorId: carole.id,
        classTypeId: classTypeByName['Full Body'].id,
        canTeach: true,
      },
    ],
  });

  const adminPassword = await bcrypt.hash('Admin2026!', 10);
  const demoPassword = await bcrypt.hash('Demo2026!', 10);

  const adminUser = await prisma.user.create({
    data: {
      id: 'demo-admin-user',
      email: 'admin@rostersyncos.io',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });
  const schedulerUser = await prisma.user.create({
    data: {
      id: 'demo-scheduler-user',
      email: 'scheduler@rostersyncos.io',
      passwordHash: demoPassword,
      role: Role.SCHEDULER,
    },
  });
  const caroleUser = await prisma.user.create({
    data: {
      id: 'demo-carole-user',
      email: 'carole@rostersyncos.io',
      passwordHash: demoPassword,
      role: Role.INSTRUCTOR,
      instructorId: carole.id,
    },
  });
  await prisma.user.create({
    data: {
      id: 'demo-emily-user',
      email: 'emily@rostersyncos.io',
      passwordHash: demoPassword,
      role: Role.INSTRUCTOR,
      instructorId: emily.id,
    },
  });

  const slots = await Promise.all([
    prisma.recurringSlotTemplate.create({
      data: {
        studioId: studioA.id,
        name: 'Mon 9:00 HIIT',
        weekday: 1,
        startTime: '09:00',
        durationMins: 45,
        defaultClassTypeId: classTypeByName.HIIT.id,
        defaultInstructorId: dave.id,
        isActive: true,
        locationLabel: 'Main Room',
      },
    }),
    prisma.recurringSlotTemplate.create({
      data: {
        studioId: studioA.id,
        name: 'Tue 8:00 Booty & Abs',
        weekday: 2,
        startTime: '08:00',
        durationMins: 50,
        defaultClassTypeId: classTypeByName['Booty & Abs'].id,
        defaultInstructorId: instructorA.id,
        isActive: true,
        locationLabel: 'Main Room',
      },
    }),
    prisma.recurringSlotTemplate.create({
      data: {
        studioId: studioA.id,
        name: 'Wed 7:00 Yoga',
        weekday: 3,
        startTime: '07:00',
        durationMins: 60,
        defaultClassTypeId: classTypeByName.Yoga.id,
        defaultInstructorId: emily.id,
        isActive: true,
        locationLabel: 'Studio 2',
      },
    }),
    prisma.recurringSlotTemplate.create({
      data: {
        studioId: studioA.id,
        name: 'Thu 10:00 Strength',
        weekday: 4,
        startTime: '10:00',
        durationMins: 50,
        defaultClassTypeId: classTypeByName.Strength.id,
        defaultInstructorId: dave.id,
        isActive: true,
        locationLabel: 'Main Room',
      },
    }),
    prisma.recurringSlotTemplate.create({
      data: {
        studioId: studioA.id,
        name: 'Fri 8:00 Full Body',
        weekday: 5,
        startTime: '08:00',
        durationMins: 45,
        defaultClassTypeId: classTypeByName['Full Body'].id,
        defaultInstructorId: instructorA.id,
        isActive: true,
        locationLabel: 'Main Room',
      },
    }),
    prisma.recurringSlotTemplate.create({
      data: {
        studioId: studioA.id,
        name: 'Sat 9:00 Mobility',
        weekday: 6,
        startTime: '09:00',
        durationMins: 50,
        defaultClassTypeId: classTypeByName.Mobility.id,
        defaultInstructorId: emily.id,
        isActive: true,
        locationLabel: 'Studio 2',
      },
    }),
  ]);

  const slotByName = Object.fromEntries(slots.map((slot) => [slot.name, slot]));

  const draftWeek = await prisma.week.create({
    data: {
      studioId: studioA.id,
      weekStartDate: new Date('2026-03-02T00:00:00.000Z'),
      status: WeekStatus.DRAFT,
    },
  });

  const draftTuesday = await prisma.sessionOccurrence.create({
    data: {
      studioId: studioA.id,
      weekId: draftWeek.id,
      slotTemplateId: slotByName['Tue 8:00 Booty & Abs'].id,
      sessionDate: new Date('2026-03-03T00:00:00.000Z'),
      startDateTimeUTC: new Date('2026-03-03T12:00:00.000Z'),
      endDateTimeUTC: new Date('2026-03-03T12:50:00.000Z'),
      status: SessionStatus.COVER_ASSIGNED,
      baseClassTypeId: classTypeByName['Booty & Abs'].id,
      baseInstructorId: instructorA.id,
    },
  });

  await prisma.sessionOccurrence.createMany({
    data: [
      {
        studioId: studioA.id,
        weekId: draftWeek.id,
        slotTemplateId: slotByName['Mon 9:00 HIIT'].id,
        sessionDate: new Date('2026-03-02T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-02T13:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-02T13:45:00.000Z'),
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: classTypeByName.HIIT.id,
        baseInstructorId: dave.id,
      },
      {
        studioId: studioA.id,
        weekId: draftWeek.id,
        slotTemplateId: slotByName['Wed 7:00 Yoga'].id,
        sessionDate: new Date('2026-03-04T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-04T11:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-04T12:00:00.000Z'),
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: classTypeByName.Yoga.id,
        baseInstructorId: emily.id,
      },
      {
        studioId: studioA.id,
        weekId: draftWeek.id,
        slotTemplateId: slotByName['Thu 10:00 Strength'].id,
        sessionDate: new Date('2026-03-05T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-05T14:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-05T14:50:00.000Z'),
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: classTypeByName.Strength.id,
        baseInstructorId: dave.id,
      },
      {
        studioId: studioA.id,
        weekId: draftWeek.id,
        slotTemplateId: slotByName['Fri 8:00 Full Body'].id,
        sessionDate: new Date('2026-03-06T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-06T12:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-06T12:45:00.000Z'),
        status: SessionStatus.COVER_PENDING,
        baseClassTypeId: classTypeByName['Full Body'].id,
        baseInstructorId: instructorA.id,
      },
      {
        studioId: studioA.id,
        weekId: draftWeek.id,
        slotTemplateId: slotByName['Sat 9:00 Mobility'].id,
        sessionDate: new Date('2026-03-07T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-07T13:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-07T13:50:00.000Z'),
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: classTypeByName.Mobility.id,
        baseInstructorId: emily.id,
      },
    ],
  });

  await prisma.unavailability.createMany({
    data: [
      {
        instructorId: instructorA.id,
        startDateTimeUTC: new Date('2026-03-03T11:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-03T14:00:00.000Z'),
        type: UnavailabilityType.SICK,
        note: 'Flu - cannot teach.',
      },
      {
        instructorId: emily.id,
        startDateTimeUTC: new Date('2026-03-06T00:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-07T00:00:00.000Z'),
        type: UnavailabilityType.HOLIDAY,
        note: 'Family vacation day.',
      },
    ],
  });

  const draftCompatibility = await resolveCompatibleClassType({
    studioId: studioA.id,
    currentClassTypeId: classTypeByName['Booty & Abs'].id,
    instructorId: carole.id,
  });

  await prisma.sessionOccurrence.update({
    where: { id: draftTuesday.id },
    data: {
      overrideInstructorId: carole.id,
      overrideClassTypeId: draftCompatibility.resolvedClassTypeId,
      overrideReason: draftCompatibility.reason,
    },
  });

  const fridayDraftSession = await prisma.sessionOccurrence.findFirstOrThrow({
    where: {
      weekId: draftWeek.id,
      slotTemplateId: slotByName['Fri 8:00 Full Body'].id,
    },
  });

  const draftAcceptedOpportunity = await prisma.coverOpportunity.create({
    data: {
      sessionId: draftTuesday.id,
      requestedByUserId: schedulerUser.id,
      status: OpportunityStatus.ASSIGNED,
    },
  });
  await prisma.coverOffer.create({
    data: {
      opportunityId: draftAcceptedOpportunity.id,
      instructorId: carole.id,
      response: OfferResponse.ACCEPT,
      rankScore: 92,
      reason: 'Available and can teach Full Body through compatibility fallback.',
      respondedAt: new Date('2026-03-01T18:00:00.000Z'),
    },
  });

  const draftOpenOpportunity = await prisma.coverOpportunity.create({
    data: {
      sessionId: fridayDraftSession.id,
      requestedByUserId: schedulerUser.id,
      status: OpportunityStatus.OFFERED,
    },
  });
  await prisma.coverOffer.createMany({
    data: [
      {
        opportunityId: draftOpenOpportunity.id,
        instructorId: carole.id,
        response: OfferResponse.PENDING,
        rankScore: 88,
        reason: 'Strong fit for Full Body and available at that time.',
      },
      {
        opportunityId: draftOpenOpportunity.id,
        instructorId: dave.id,
        response: OfferResponse.PENDING,
        rankScore: 79,
        reason: 'Available and qualified as a fallback.',
      },
    ],
  });

  const publishedWeek = await prisma.week.create({
    data: {
      studioId: studioA.id,
      weekStartDate: new Date('2026-03-09T00:00:00.000Z'),
      status: WeekStatus.DRAFT,
    },
  });

  const publishedSessions = await Promise.all([
    prisma.sessionOccurrence.create({
      data: {
        studioId: studioA.id,
        weekId: publishedWeek.id,
        slotTemplateId: slotByName['Mon 9:00 HIIT'].id,
        sessionDate: new Date('2026-03-09T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-09T13:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-09T13:45:00.000Z'),
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: classTypeByName.HIIT.id,
        baseInstructorId: dave.id,
      },
    }),
    prisma.sessionOccurrence.create({
      data: {
        studioId: studioA.id,
        weekId: publishedWeek.id,
        slotTemplateId: slotByName['Tue 8:00 Booty & Abs'].id,
        sessionDate: new Date('2026-03-10T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-10T12:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-10T12:50:00.000Z'),
        status: SessionStatus.COVER_ASSIGNED,
        baseClassTypeId: classTypeByName['Booty & Abs'].id,
        baseInstructorId: instructorA.id,
      },
    }),
    prisma.sessionOccurrence.create({
      data: {
        studioId: studioA.id,
        weekId: publishedWeek.id,
        slotTemplateId: slotByName['Wed 7:00 Yoga'].id,
        sessionDate: new Date('2026-03-11T00:00:00.000Z'),
        startDateTimeUTC: new Date('2026-03-11T11:00:00.000Z'),
        endDateTimeUTC: new Date('2026-03-11T12:00:00.000Z'),
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: classTypeByName.Yoga.id,
        baseInstructorId: emily.id,
      },
    }),
  ]);

  const publishedCompatibility = await resolveCompatibleClassType({
    studioId: studioA.id,
    currentClassTypeId: classTypeByName['Booty & Abs'].id,
    instructorId: carole.id,
  });

  await prisma.sessionOccurrence.update({
    where: { id: publishedSessions[1].id },
    data: {
      overrideInstructorId: carole.id,
      overrideClassTypeId: publishedCompatibility.resolvedClassTypeId,
      overrideReason: publishedCompatibility.reason,
    },
  });

  const { weekHash, effectiveSessions } = await buildWeekHash(publishedWeek.id);

  await prisma.week.update({
    where: { id: publishedWeek.id },
    data: {
      status: WeekStatus.PUBLISHED,
      publishVersion: 1,
      publishedAt: new Date('2026-03-08T18:00:00.000Z'),
      publishedBy: adminUser.id,
      weekHash,
    },
  });

  await prisma.publishSnapshot.create({
    data: {
      studioId: studioA.id,
      weekId: publishedWeek.id,
      publishVersion: 1,
      weekHash,
      effectiveJson: effectiveSessions,
      publishedBy: adminUser.id,
      publishedAt: new Date('2026-03-08T18:00:00.000Z'),
      correlationId: 'demo-publish-v1',
    },
  });

  const publishedBasePayload = {
    sessionId: publishedSessions[0].id,
    startDateTimeUTC: '2026-03-09T13:00:00.000Z',
    endDateTimeUTC: '2026-03-09T13:45:00.000Z',
    instructorId: dave.id,
    instructorName: dave.fullName,
    classTypeId: classTypeByName.HIIT.id,
    classTypeName: 'HIIT',
    reason: null,
  };
  const publishedCoverPayload = {
    sessionId: publishedSessions[1].id,
    startDateTimeUTC: '2026-03-10T12:00:00.000Z',
    endDateTimeUTC: '2026-03-10T12:50:00.000Z',
    instructorId: carole.id,
    instructorName: carole.fullName,
    classTypeId: classTypeByName['Full Body'].id,
    classTypeName: 'Full Body',
    reason: publishedCompatibility.reason,
  };
  const publishedYogaPayload = {
    sessionId: publishedSessions[2].id,
    startDateTimeUTC: '2026-03-11T11:00:00.000Z',
    endDateTimeUTC: '2026-03-11T12:00:00.000Z',
    instructorId: emily.id,
    instructorName: emily.fullName,
    classTypeId: classTypeByName.Yoga.id,
    classTypeName: 'Yoga',
    reason: null,
  };

  const publishedBaseHash = sha256(publishedBasePayload);
  const publishedCoverHash = sha256(publishedCoverPayload);
  const publishedYogaHash = sha256(publishedYogaPayload);

  await prisma.sessionOccurrence.updateMany({
    where: { id: { in: publishedSessions.map((session) => session.id) } },
    data: {
      lastSyncAt: new Date('2026-03-08T18:05:00.000Z'),
    },
  });
  await prisma.sessionOccurrence.update({
    where: { id: publishedSessions[0].id },
    data: { lastSyncedHash: publishedBaseHash },
  });
  await prisma.sessionOccurrence.update({
    where: { id: publishedSessions[1].id },
    data: { lastSyncedHash: publishedCoverHash },
  });

  await prisma.wixSyncJob.createMany({
    data: [
      {
        studioId: studioA.id,
        sessionId: publishedSessions[0].id,
        jobType: WixJobType.UPSERT_SESSION,
        idempotencyKey: `UPSERT:${publishedSessions[0].id}:${weekHash}`,
        status: WixJobStatus.SUCCEEDED,
        attempts: 1,
        publishVersion: 1,
        correlationId: 'demo-publish-v1',
        payloadJson: publishedBasePayload,
        payloadHash: publishedBaseHash,
      },
      {
        studioId: studioA.id,
        sessionId: publishedSessions[1].id,
        jobType: WixJobType.UPSERT_SESSION,
        idempotencyKey: `UPSERT:${publishedSessions[1].id}:${weekHash}`,
        status: WixJobStatus.FAILED,
        attempts: 1,
        lastError: 'STUB: Simulated Wix API timeout',
        publishVersion: 1,
        correlationId: 'demo-publish-v1',
        payloadJson: publishedCoverPayload,
        payloadHash: publishedCoverHash,
      },
      {
        studioId: studioA.id,
        sessionId: publishedSessions[2].id,
        jobType: WixJobType.UPSERT_SESSION,
        idempotencyKey: `UPSERT:${publishedSessions[2].id}:${weekHash}`,
        status: WixJobStatus.PENDING,
        attempts: 0,
        publishVersion: 1,
        correlationId: 'demo-publish-v1',
        payloadJson: publishedYogaPayload,
        payloadHash: publishedYogaHash,
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: caroleUser.id,
        type: 'COVER_OPPORTUNITY',
        title: 'Cover Opportunity Available',
        body: 'Fri 8:00 Full Body has an open substitution request waiting for your response.',
      },
      {
        userId: schedulerUser.id,
        type: 'COVER_ASSIGNED',
        title: 'Cover Assigned',
        body: 'Carole accepted Tuesday Booty & Abs and the session now runs as Full Body.',
      },
      {
        userId: caroleUser.id,
        type: 'COVER_ASSIGNED',
        title: 'You Were Assigned',
        body: 'You are covering Tuesday Booty & Abs as Full Body in the draft workflow week.',
      },
      {
        userId: adminUser.id,
        type: 'SCHEDULE_PUBLISHED',
        title: 'Schedule Published',
        body: 'Published Sync Week was released as v1 and queued for STUB sync.',
      },
      {
        userId: schedulerUser.id,
        type: 'SCHEDULE_PUBLISHED',
        title: 'Schedule Published',
        body: 'Published Sync Week was released as v1 and queued for STUB sync.',
      },
      {
        userId: adminUser.id,
        type: 'SYNC_FAILED',
        title: 'Sync Failed',
        body: 'The published compatibility override failed its first STUB sync attempt and can be retried from the dashboard.',
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        studioId: studioA.id,
        actorUserId: schedulerUser.id,
        entityType: 'SessionOccurrence',
        entityId: draftTuesday.id,
        action: 'COVER_ACCEPTED',
        reason: draftCompatibility.reason,
        beforeJson: {
          instructor: 'Instructor A',
          classType: 'Booty & Abs',
        },
        afterJson: {
          instructor: 'Carole',
          classType: 'Full Body',
        },
      },
      {
        studioId: studioA.id,
        actorUserId: adminUser.id,
        entityType: 'Week',
        entityId: publishedWeek.id,
        action: 'PUBLISH_WEEK',
        reason: 'Publish v1',
        correlationId: 'demo-publish-v1',
        afterJson: {
          publishVersion: 1,
          weekHash,
          sessionCount: effectiveSessions.length,
        },
      },
      {
        studioId: studioA.id,
        actorUserId: adminUser.id,
        entityType: 'WixSyncJob',
        entityId: publishedSessions[1].id,
        action: 'SYNC_FAILED',
        reason: 'STUB: Simulated Wix API timeout',
        correlationId: 'demo-publish-v1',
      },
    ],
  });

  console.log('Seed complete: draft and published demo weeks created.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
