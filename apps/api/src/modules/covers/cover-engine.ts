import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  OpportunityStatus,
  OfferResponse,
  SessionStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CoverOpportunityEngine {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async generateOffersForOpportunity(opportunityId: string) {
    const opportunity = await this.prisma.coverOpportunity.findUnique({
      where: { id: opportunityId },
      include: {
        session: {
          include: {
            baseClassType: true,
            overrideClassType: true,
            baseInstructor: true,
            overrideInstructor: true,
          },
        },
      },
    });

    if (!opportunity) throw new NotFoundException('Opportunity not found');

    const session = opportunity.session;
    const existingOffers = await this.prisma.coverOffer.findMany({
      where: { opportunityId },
      select: { instructorId: true },
    });
    const existingInstructorIds = new Set(
      existingOffers.map((offer) => offer.instructorId),
    );
    const requiredClassTypeId =
      session.overrideClassTypeId || session.baseClassTypeId;

    // Resolve userId -> instructorId to properly exclude the requester
    let excludeInstructorId: string | undefined;
    if (opportunity.requestedByUserId) {
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: opportunity.requestedByUserId },
        select: { instructorId: true },
      });
      excludeInstructorId = requestingUser?.instructorId ?? undefined;
    }
    const excludedInstructorIds = [
      excludeInstructorId,
      session.baseInstructorId,
      session.overrideInstructorId,
    ].filter(Boolean) as string[];

    // 1. Find all instructors in studio except the one who requested it
    const allInstructors = await this.prisma.instructor.findMany({
      where: {
        studioId: session.studioId,
        isActive: true,
        ...(excludedInstructorIds.length > 0
          ? { id: { notIn: excludedInstructorIds } }
          : {}),
      },
      include: {
        skills: true,
        unavailability: {
          where: {
            startDateTimeUTC: { lte: session.endDateTimeUTC },
            endDateTimeUTC: { gte: session.startDateTimeUTC },
          },
        },
        baseSessions: {
          where: {
            startDateTimeUTC: {
              gte: new Date(
                session.startDateTimeUTC.getTime() - 7 * 24 * 60 * 60 * 1000,
              ),
            },
            endDateTimeUTC: {
              lte: new Date(
                session.endDateTimeUTC.getTime() + 7 * 24 * 60 * 60 * 1000,
              ),
            },
          },
        },
        overrideSessions: {
          where: {
            startDateTimeUTC: {
              gte: new Date(
                session.startDateTimeUTC.getTime() - 7 * 24 * 60 * 60 * 1000,
              ),
            },
            endDateTimeUTC: {
              lte: new Date(
                session.endDateTimeUTC.getTime() + 7 * 24 * 60 * 60 * 1000,
              ),
            },
          },
        },
      },
    });

    const compatRules = await this.prisma.compatibilityRule.findMany({
      where: {
        studioId: session.studioId,
        fromClassTypeId: requiredClassTypeId,
        isEnabled: true,
      },
      orderBy: { priority: 'asc' },
    });

    const candidateOffers = [];

    for (const instructor of allInstructors) {
      // 1. Availability check:
      if (instructor.unavailability.length > 0) {
        continue; // Unavailable
      }

      // 2. Double Booked check:
      const sessions = [
        ...instructor.baseSessions.filter(
          (s) => s.overrideInstructorId === null,
        ),
        ...instructor.overrideSessions,
      ];
      const isDoubleBooked = sessions.some(
        (s) =>
          (session.startDateTimeUTC >= s.startDateTimeUTC &&
            session.startDateTimeUTC < s.endDateTimeUTC) ||
          (session.endDateTimeUTC > s.startDateTimeUTC &&
            session.endDateTimeUTC <= s.endDateTimeUTC),
      );

      if (isDoubleBooked) continue;

      // 3. Teachability / Compatibility
      let rankScore = 0;
      let reason = '';

      const directSkill = instructor.skills.find(
        (s) => s.classTypeId === requiredClassTypeId && s.canTeach,
      );
      if (directSkill) {
        rankScore = 100;
        reason = 'Directly matches required class type.';
      } else {
        // Evaluate compat fallback
        let foundCompat = false;
        for (const rule of compatRules) {
          if (
            instructor.skills.some(
              (s) => s.classTypeId === rule.toClassTypeId && s.canTeach,
            )
          ) {
            // Apply penalty based on rule priority (e.g., lower priority number = better)
            rankScore = Math.max(0, 80 - rule.priority * 10);
            reason = `Compatibility match via rule (priority ${rule.priority}).`;
            foundCompat = true;
            break;
          }
        }
        if (!foundCompat) continue; // Cannot teach directly or via compat
      }

      // 4. Load adjustment (prefer instructors with fewer sessions this week)
      // We will roughly penalize by 2 points per session
      const loadPenalty = sessions.length * 2;
      rankScore = Math.max(0, rankScore - loadPenalty);

      if (sessions.length > (instructor.maxWeeklySlots || 15)) {
        rankScore -= 50; // heavy penalty for exceeding max weekly slots
        reason += ' (Max weekly slot load exceeded threshold)';
      }

      candidateOffers.push({
        opportunityId: opportunity.id,
        instructorId: instructor.id,
        rankScore,
        reason,
        response: OfferResponse.PENDING,
      });
    }

    // Sort by rank score descending
    candidateOffers.sort((a, b) => b.rankScore - a.rankScore);

    // Filter to top 5 candidates
    const topCandidates = candidateOffers.slice(0, 5);

    if (topCandidates.length > 0) {
      await this.prisma.$transaction(
        topCandidates.map((c) =>
          this.prisma.coverOffer.upsert({
            where: {
              opportunityId_instructorId: {
                opportunityId: c.opportunityId,
                instructorId: c.instructorId,
              },
            },
            update: {},
            create: c,
          }),
        ),
      );

      await this.prisma.coverOpportunity.update({
        where: { id: opportunityId },
        data: { status: OpportunityStatus.OFFERED },
      });

      await this.prisma.sessionOccurrence.update({
        where: { id: session.id },
        data: { status: SessionStatus.COVER_PENDING },
      });

      const newlyOfferedInstructorIds = topCandidates
        .map((candidate) => candidate.instructorId)
        .filter((instructorId) => !existingInstructorIds.has(instructorId));

      const className =
        session.overrideClassType?.name || session.baseClassType?.name || 'Class';
      try {
        await this.notificationsService.notifyCoverOpportunity({
          className,
          startDateTimeUTC: session.startDateTimeUTC,
          instructorIds: newlyOfferedInstructorIds,
        });
      } catch (error) {
        console.error('Failed to create cover opportunity notifications', error);
      }
    }

    return { opportunityId, offersCreated: topCandidates.length };
  }
}
