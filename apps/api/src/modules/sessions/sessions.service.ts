import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  AssignInstructorDto,
  OverrideSessionDto,
  UpdateSessionStatusDto,
  GetSessionsFilterDto,
  BulkUpdateSessionStatusDto,
} from './dto/session.dtos';
import { OpportunityStatus, SessionStatus } from '@prisma/client';
import { CoverOpportunityEngine } from '../covers/cover-engine';
import { resolveActorUserId } from '../../common/utils/actor';

// Valid session status transitions
const SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  [SessionStatus.SCHEDULED]: [
    SessionStatus.NEEDS_COVER,
    SessionStatus.CANCELLED,
  ],
  [SessionStatus.NEEDS_COVER]: [
    SessionStatus.COVER_PENDING,
    SessionStatus.SCHEDULED, // cover cancelled → back to scheduled
    SessionStatus.CANCELLED,
  ],
  [SessionStatus.COVER_PENDING]: [
    SessionStatus.COVER_ASSIGNED,
    SessionStatus.NEEDS_COVER, // all offers declined → back to needs cover
    SessionStatus.SCHEDULED, // cover cancelled → back to scheduled
    SessionStatus.CANCELLED,
  ],
  [SessionStatus.COVER_ASSIGNED]: [
    SessionStatus.SCHEDULED, // unassign cover → back to scheduled
    SessionStatus.CANCELLED,
  ],
  [SessionStatus.CANCELLED]: [
    SessionStatus.SCHEDULED, // restore cancelled session
  ],
};

function assertSessionTransition(from: SessionStatus, to: SessionStatus): void {
  if (!SESSION_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(
      `Invalid session status transition: ${from} → ${to}`,
    );
  }
}

@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
    private coverEngine: CoverOpportunityEngine,
  ) {}

  private async openCoverOpportunities(
    studioId: string,
    sessionIds: string[],
    requestedByUserId: string,
  ) {
    const opportunityIds: string[] = [];

    for (const sessionId of sessionIds) {
      const opportunity = await this.prisma.coverOpportunity.upsert({
        where: { sessionId },
        update: {
          status: OpportunityStatus.OPEN,
          requestedByUserId,
        },
        create: {
          sessionId,
          requestedByUserId,
          status: OpportunityStatus.OPEN,
        },
      });
      opportunityIds.push(opportunity.id);
    }

    for (const opportunityId of opportunityIds) {
      await this.coverEngine.generateOffersForOpportunity(opportunityId);
    }

    return { studioId, opportunityIds };
  }

  async getSessions(studioId: string, filters: GetSessionsFilterDto) {
    if (!filters?.startDate || !filters?.endDate) {
      throw new BadRequestException('startDate and endDate are required');
    }
    const start = new Date(filters.startDate);
    const end = new Date(filters.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'startDate and endDate must be valid ISO timestamps',
      );
    }

    return this.prisma.sessionOccurrence.findMany({
      where: {
        studioId,
        startDateTimeUTC: {
          gte: start,
          lte: end,
        },
        ...(filters.instructorId
          ? {
              OR: [
                { overrideInstructorId: filters.instructorId },
                {
                  overrideInstructorId: null,
                  baseInstructorId: filters.instructorId,
                },
              ],
            }
          : {}),
      },
      include: {
        baseInstructor: true,
        overrideInstructor: true,
        baseClassType: true,
        overrideClassType: true,
        coverOpportunity: { include: { offers: true } },
      },
      orderBy: [{ startDateTimeUTC: 'asc' }],
    });
  }

  async getSessionById(sessionId: string) {
    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: sessionId },
      include: {
        baseInstructor: true,
        overrideInstructor: true,
        baseClassType: true,
        overrideClassType: true,
        coverOpportunity: { include: { offers: true } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async bulkUpdateStatus(
    studioId: string,
    dto: BulkUpdateSessionStatusDto,
    userId: string = 'SYSTEM',
  ) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);

    if (!dto.sessionIds?.length) {
      throw new BadRequestException('sessionIds must be a non-empty array');
    }
    if (!Object.values(SessionStatus).includes(dto.status as SessionStatus)) {
      throw new BadRequestException(
        `Invalid status: ${dto.status}. Must be one of: ${Object.values(SessionStatus).join(', ')}`,
      );
    }

    const sessions = await this.prisma.sessionOccurrence.findMany({
      where: { studioId, id: { in: dto.sessionIds } },
      select: { id: true, status: true },
    });
    if (sessions.length !== dto.sessionIds.length) {
      throw new NotFoundException('One or more sessions were not found');
    }

    // Validate all transitions before applying
    const targetStatus = dto.status as SessionStatus;
    const invalidSessions = sessions.filter(
      (s) => !SESSION_TRANSITIONS[s.status]?.includes(targetStatus),
    );
    if (invalidSessions.length > 0) {
      const examples = invalidSessions
        .slice(0, 3)
        .map((s) => `${s.status} → ${targetStatus}`)
        .join(', ');
      throw new BadRequestException(
        `Invalid status transition for ${invalidSessions.length} session(s): ${examples}`,
      );
    }

    const result = await this.prisma.sessionOccurrence.updateMany({
      where: { studioId, id: { in: dto.sessionIds } },
      data: { status: targetStatus },
    });

    if (dto.status === SessionStatus.NEEDS_COVER && result.count > 0) {
      await this.openCoverOpportunities(
        studioId,
        sessions.map((session) => session.id),
        actorUserId,
      );
    }

    if (result.count > 0) {
      await this.prisma.auditLog.create({
        data: {
          studioId,
          actorUserId,
          entityType: 'SessionOccurrence',
          entityId: 'BULK_UPDATE',
          action: 'BULK_STATUS_UPDATE',
          reason:
            dto.reason || `Updated ${result.count} sessions to ${dto.status}`,
        },
      });
    }

    return { updatedCount: result.count };
  }

  async assignInstructor(
    sessionId: string,
    dto: AssignInstructorDto,
    userId: string = 'SYSTEM',
  ) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);
    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (dto.instructorId) {
      const instructor = await this.prisma.instructor.findUnique({
        where: { id: dto.instructorId },
      });
      if (!instructor) {
        throw new NotFoundException(`Instructor ${dto.instructorId} not found`);
      }
    }

    const updated = await this.prisma.sessionOccurrence.update({
      where: { id: sessionId },
      data: {
        overrideInstructorId: dto.instructorId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        studioId: session.studioId,
        actorUserId,
        entityType: 'SessionOccurrence',
        entityId: sessionId,
        action: 'ASSIGN_INSTRUCTOR',
        reason: 'Admin assigned instructor explicitly',
      },
    });

    return updated;
  }

  async overrideSession(
    sessionId: string,
    dto: OverrideSessionDto,
    userId: string = 'SYSTEM',
  ) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);
    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    if (dto.instructorId) {
      const instructor = await this.prisma.instructor.findUnique({
        where: { id: dto.instructorId },
      });
      if (!instructor) {
        throw new NotFoundException(`Instructor ${dto.instructorId} not found`);
      }
    }
    if (dto.classTypeId) {
      const classType = await this.prisma.classType.findUnique({
        where: { id: dto.classTypeId },
      });
      if (!classType) {
        throw new NotFoundException(`Class type ${dto.classTypeId} not found`);
      }
    }

    const updated = await this.prisma.sessionOccurrence.update({
      where: { id: sessionId },
      data: {
        overrideClassTypeId: dto.classTypeId,
        overrideInstructorId: dto.instructorId,
        overrideReason: dto.reason,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        studioId: session.studioId,
        actorUserId,
        entityType: 'SessionOccurrence',
        entityId: sessionId,
        action: 'OVERRIDE_SESSION',
        reason: dto.reason || 'Admin explicitly overrode session',
      },
    });

    return updated;
  }

  async getSessionAuditTrail(sessionId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType: 'SessionOccurrence', entityId: sessionId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { email: true, role: true } } },
    });
  }

  async getSessionDetail(sessionId: string) {
    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: sessionId },
      include: {
        baseInstructor: true,
        overrideInstructor: true,
        baseClassType: true,
        overrideClassType: true,
        coverOpportunity: {
          include: {
            offers: { include: { instructor: true } },
          },
        },
        week: {
          select: {
            status: true,
            weekStartDate: true,
            publishVersion: true,
            weekHash: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');

    const auditTrail = await this.getSessionAuditTrail(sessionId);

    const syncHistory = await this.prisma.wixSyncJob.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Compute explainability data
    const explainability = await this.computeExplainability(session);

    return { session, auditTrail, syncHistory, explainability };
  }

  private async computeExplainability(session: {
    id: string;
    weekId: string;
    baseInstructorId: string | null;
    overrideInstructorId: string | null;
    baseClassTypeId: string | null;
    overrideClassTypeId: string | null;
    baseInstructor: { id: string; fullName: string } | null;
    overrideInstructor: { id: string; fullName: string } | null;
    baseClassType: { id: string; name: string } | null;
    overrideClassType: { id: string; name: string } | null;
    status: string;
    coverOpportunity?: {
      status: string;
      offers: {
        response: string;
        instructor: { id: string; fullName: string };
      }[];
    } | null;
  }) {
    const steps: { layer: string; label: string; detail: string }[] = [];
    const effectiveInstructorId =
      session.overrideInstructorId || session.baseInstructorId;
    const effectiveClassTypeId =
      session.overrideClassTypeId || session.baseClassTypeId;

    // Step 1: Template default
    steps.push({
      layer: 'TEMPLATE',
      label: 'Slot Template',
      detail: `${session.baseClassType?.name ?? 'Unknown'} with ${session.baseInstructor?.fullName ?? 'Unassigned'}`,
    });

    // Step 2: Override (if any)
    if (session.overrideInstructorId || session.overrideClassTypeId) {
      const parts: string[] = [];
      if (session.overrideClassTypeId) {
        parts.push(`Class → ${session.overrideClassType?.name ?? 'Unknown'}`);
      }
      if (session.overrideInstructorId) {
        parts.push(
          `Instructor → ${session.overrideInstructor?.fullName ?? 'Unknown'}`,
        );
      }
      steps.push({
        layer: 'OVERRIDE',
        label: 'Manual Override',
        detail: parts.join(', '),
      });
    }

    // Step 3: Cover assignment (if applicable)
    if (
      session.coverOpportunity &&
      session.coverOpportunity.status === 'ASSIGNED'
    ) {
      const accepted = session.coverOpportunity.offers.find(
        (o) => o.response === 'ACCEPT',
      );
      if (accepted) {
        steps.push({
          layer: 'COVER',
          label: 'Cover Accepted',
          detail: `${accepted.instructor.fullName} accepted via cover marketplace`,
        });
      }
    }

    // Step 4: Effective result
    const effectiveInstructorName =
      session.overrideInstructor?.fullName ??
      session.baseInstructor?.fullName ??
      'Unassigned';
    const effectiveClassName =
      session.overrideClassType?.name ??
      session.baseClassType?.name ??
      'Unknown';
    steps.push({
      layer: 'EFFECTIVE',
      label: 'Current Assignment',
      detail: `${effectiveClassName} taught by ${effectiveInstructorName}`,
    });

    // Skill qualification check
    let skillMatch: {
      qualified: boolean;
      detail: string;
    } = { qualified: true, detail: 'No instructor assigned' };

    if (effectiveInstructorId && effectiveClassTypeId) {
      const skill = await this.prisma.instructorSkill.findUnique({
        where: {
          instructorId_classTypeId: {
            instructorId: effectiveInstructorId,
            classTypeId: effectiveClassTypeId,
          },
        },
      });
      if (skill?.canTeach) {
        skillMatch = {
          qualified: true,
          detail: `${effectiveInstructorName} is certified for ${effectiveClassName}`,
        };
      } else {
        // Check compatibility rules
        const compatRules = await this.prisma.compatibilityRule.findMany({
          where: { fromClassTypeId: effectiveClassTypeId },
          include: { toClassType: true },
        });
        const instructorSkills = await this.prisma.instructorSkill.findMany({
          where: {
            instructorId: effectiveInstructorId,
            canTeach: true,
          },
        });
        const instructorClassIds = instructorSkills.map((s) => s.classTypeId);
        const matchingRule = compatRules.find((r) =>
          instructorClassIds.includes(r.toClassTypeId),
        );
        if (matchingRule) {
          skillMatch = {
            qualified: true,
            detail: `Via compatibility: ${effectiveInstructorName} teaches ${matchingRule.toClassType.name} (compatible with ${effectiveClassName})`,
          };
        } else {
          skillMatch = {
            qualified: false,
            detail: `${effectiveInstructorName} is not certified for ${effectiveClassName} and no compatibility rule applies`,
          };
        }
      }
    }

    // Weekly load
    let weeklyLoad: { current: number; max: number | null } | null = null;
    if (effectiveInstructorId && session.weekId) {
      const week = await this.prisma.week.findUnique({
        where: { id: session.weekId },
        select: { weekStartDate: true, studioId: true },
      });
      if (week) {
        const weekStart = new Date(week.weekStartDate);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const sessionCount = await this.prisma.sessionOccurrence.count({
          where: {
            studioId: week.studioId,
            startDateTimeUTC: { gte: weekStart, lt: weekEnd },
            status: { not: 'CANCELLED' as SessionStatus },
            OR: [
              {
                overrideInstructorId: effectiveInstructorId,
              },
              {
                baseInstructorId: effectiveInstructorId,
                overrideInstructorId: null,
              },
            ],
          },
        });

        const instructor = await this.prisma.instructor.findUnique({
          where: { id: effectiveInstructorId },
          select: { maxWeeklySlots: true },
        });

        weeklyLoad = {
          current: sessionCount,
          max: instructor?.maxWeeklySlots ?? null,
        };
      }
    }

    // Confidence score (0-100) based on assignment quality signals
    let confidence = 100;
    const riskFlags: { level: 'HIGH' | 'MEDIUM' | 'LOW'; label: string; fix: string }[] =
      [];

    if (!effectiveInstructorId) {
      confidence = 0;
      riskFlags.push({
        level: 'HIGH',
        label: 'No instructor assigned',
        fix: 'Assign an instructor in the session details',
      });
    } else {
      if (!skillMatch.qualified) {
        confidence -= 40;
        riskFlags.push({
          level: 'HIGH',
          label: 'Skill mismatch',
          fix: 'Assign a qualified instructor or add the skill',
        });
      }

      if (
        weeklyLoad?.max &&
        weeklyLoad.current >= weeklyLoad.max
      ) {
        confidence -= 20;
        riskFlags.push({
          level: 'MEDIUM',
          label: 'At or over weekly load limit',
          fix: 'Reassign to a less loaded instructor or increase their limit',
        });
      }

      // Check for upcoming unavailability
      if (effectiveInstructorId) {
        const unavailCount = await this.prisma.unavailability.count({
          where: {
            instructorId: effectiveInstructorId,
            startDateTimeUTC: { lte: (session as { endDateTimeUTC?: Date }).endDateTimeUTC ?? new Date() },
            endDateTimeUTC: { gte: (session as { startDateTimeUTC?: Date }).startDateTimeUTC ?? new Date() },
          },
        });
        if (unavailCount > 0) {
          confidence -= 30;
          riskFlags.push({
            level: 'HIGH',
            label: 'Instructor is marked unavailable',
            fix: 'Reassign to an available instructor or remove the unavailability',
          });
        }
      }

      // Cover not yet resolved
      if (
        session.status === 'NEEDS_COVER' ||
        session.status === 'COVER_PENDING'
      ) {
        confidence -= 15;
        riskFlags.push({
          level: 'MEDIUM',
          label: `Session is ${session.status === 'NEEDS_COVER' ? 'awaiting cover' : 'pending cover response'}`,
          fix: 'Check the cover marketplace for available substitutes',
        });
      }
    }

    confidence = Math.max(0, confidence);

    return { steps, skillMatch, weeklyLoad, confidence, riskFlags };
  }

  async updateStatus(
    sessionId: string,
    dto: UpdateSessionStatusDto,
    userId: string = 'SYSTEM',
  ) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);

    if (!Object.values(SessionStatus).includes(dto.status as SessionStatus)) {
      throw new BadRequestException(
        `Invalid status: ${dto.status}. Must be one of: ${Object.values(SessionStatus).join(', ')}`,
      );
    }

    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');

    assertSessionTransition(session.status, dto.status as SessionStatus);

    const updated = await this.prisma.sessionOccurrence.update({
      where: { id: sessionId },
      data: {
        status: dto.status as SessionStatus,
      },
    });

    if (dto.status === SessionStatus.NEEDS_COVER) {
      await this.openCoverOpportunities(
        session.studioId,
        [sessionId],
        actorUserId,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        studioId: session.studioId,
        actorUserId,
        entityType: 'SessionOccurrence',
        entityId: sessionId,
        action: 'UPDATE_STATUS',
        reason: `Status manually updated to ${dto.status}`,
      },
    });

    return updated;
  }
}
