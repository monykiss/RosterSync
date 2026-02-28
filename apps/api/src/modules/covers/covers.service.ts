import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RespondCoverOfferDto, CreateCoverRequestDto } from './dto/cover.dtos';
import {
  OfferResponse,
  SessionStatus,
  OpportunityStatus,
  Prisma,
} from '@prisma/client';
import { CompatibilityService } from '../compatibility/compatibility.service';
import { SyncService } from '../sync/sync.service';
import { CoverOpportunityEngine } from './cover-engine';
import { resolveActorUserId } from '../../common/utils/actor';
import { NotificationsService } from '../notifications/notifications.service';

// Valid cover opportunity state transitions
const VALID_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  [OpportunityStatus.OPEN]: [
    OpportunityStatus.OFFERED,
    OpportunityStatus.CANCELLED,
  ],
  [OpportunityStatus.OFFERED]: [
    OpportunityStatus.ACCEPTED,
    OpportunityStatus.ASSIGNED,
    OpportunityStatus.OPEN, // all offers declined → re-opens
    OpportunityStatus.CANCELLED,
  ],
  [OpportunityStatus.ACCEPTED]: [OpportunityStatus.ASSIGNED], // accepted → finalized
  [OpportunityStatus.ASSIGNED]: [], // terminal state
  [OpportunityStatus.EXPIRED]: [OpportunityStatus.OPEN], // can re-open after expiry
  [OpportunityStatus.CANCELLED]: [OpportunityStatus.OPEN], // can re-open
};

function assertTransition(
  from: OpportunityStatus,
  to: OpportunityStatus,
): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(
      `Invalid cover status transition: ${from} → ${to}`,
    );
  }
}

@Injectable()
export class CoversService {
  constructor(
    private prisma: PrismaService,
    private compatibilityService: CompatibilityService,
    private syncService: SyncService,
    private coverEngine: CoverOpportunityEngine,
    private notificationsService: NotificationsService,
  ) {
    void this.compatibilityService;
  }

  private async resolveEffectiveClassTypeForCover(params: {
    studioId: string;
    currentClassTypeId: string;
    instructorId: string;
    prisma?: Prisma.TransactionClient | PrismaService;
  }): Promise<{ resolvedClassTypeId: string; reason: string }> {
    const {
      studioId,
      currentClassTypeId,
      instructorId,
      prisma: db = this.prisma,
    } = params;

    const canTeach = await db.instructorSkill.findUnique({
      where: {
        instructorId_classTypeId: {
          instructorId,
          classTypeId: currentClassTypeId,
        },
      },
    });
    if (canTeach?.canTeach) {
      return {
        resolvedClassTypeId: currentClassTypeId,
        reason: 'Cover accepted. Instructor can teach original class type.',
      };
    }

    const rules = await db.compatibilityRule.findMany({
      where: { studioId, fromClassTypeId: currentClassTypeId, isEnabled: true },
      orderBy: { priority: 'asc' },
    });

    for (const rule of rules) {
      const compatSkill = await db.instructorSkill.findUnique({
        where: {
          instructorId_classTypeId: {
            instructorId,
            classTypeId: rule.toClassTypeId,
          },
        },
      });
      if (compatSkill?.canTeach) {
        return {
          resolvedClassTypeId: rule.toClassTypeId,
          reason:
            rule.reasonTemplate ||
            `Cover accepted. Applied compatibility rule priority=${rule.priority}`,
        };
      }
    }

    return {
      resolvedClassTypeId: currentClassTypeId,
      reason:
        'No compatible class type found. Keeping original; scheduler attention may be required.',
    };
  }

  private async resolveAcceptanceActorUserId(
    instructorId: string,
    fallbackUserId?: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const instructorUser = await db.user.findFirst({
      where: { instructorId },
      select: { id: true },
    });
    if (instructorUser) {
      return instructorUser.id;
    }
    return resolveActorUserId(this.prisma, fallbackUserId);
  }

  async createCoverRequest(userId: string, dto: CreateCoverRequestDto) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);
    const session = await this.prisma.sessionOccurrence.findUnique({
      where: { id: dto.sessionId },
    });

    if (!session) throw new NotFoundException('Session not found');
    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot request cover for a cancelled session',
      );
    }

    let opportunity = await this.prisma.coverOpportunity.findUnique({
      where: { sessionId: session.id },
    });

    if (!opportunity) {
      opportunity = await this.prisma.coverOpportunity.create({
        data: {
          sessionId: session.id,
          requestedByUserId: actorUserId,
          status: OpportunityStatus.OPEN,
        },
      });
    } else if (
      opportunity.status === OpportunityStatus.CANCELLED ||
      opportunity.status === OpportunityStatus.EXPIRED
    ) {
      assertTransition(
        opportunity.status as OpportunityStatus,
        OpportunityStatus.OPEN,
      );
      opportunity = await this.prisma.coverOpportunity.update({
        where: { id: opportunity.id },
        data: {
          requestedByUserId: actorUserId,
          status: OpportunityStatus.OPEN,
        },
      });
    } else if (opportunity.status === OpportunityStatus.ASSIGNED) {
      throw new BadRequestException(
        'Cover already assigned for this session. Cancel the existing assignment first.',
      );
    } else if (
      opportunity.status === OpportunityStatus.OPEN ||
      opportunity.status === OpportunityStatus.OFFERED
    ) {
      throw new BadRequestException(
        'A cover request already exists for this session',
      );
    }

    await this.prisma.sessionOccurrence.update({
      where: { id: session.id },
      data: { status: SessionStatus.NEEDS_COVER },
    });

    await this.coverEngine.generateOffersForOpportunity(opportunity.id);

    return {
      opportunity,
      message: 'Cover request submitted and offers distributed',
    };
  }

  async getStudioCoverRequests(studioId: string, status?: string) {
    return this.prisma.coverOpportunity.findMany({
      where: {
        session: { studioId },
        ...(status ? { status: status as OpportunityStatus } : {}),
      },
      include: {
        session: {
          include: {
            baseClassType: true,
            baseInstructor: true,
            overrideClassType: true,
            overrideInstructor: true,
          },
        },
        offers: {
          include: { instructor: true },
          orderBy: { rankScore: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelCoverRequest(id: string, userId: string) {
    const opportunity = await this.prisma.coverOpportunity.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!opportunity) {
      throw new NotFoundException('Cover opportunity not found');
    }

    assertTransition(opportunity.status, OpportunityStatus.CANCELLED);

    const actorUserId = await resolveActorUserId(this.prisma, userId);

    await this.prisma.$transaction([
      this.prisma.coverOpportunity.update({
        where: { id },
        data: { status: OpportunityStatus.CANCELLED },
      }),
      this.prisma.sessionOccurrence.update({
        where: { id: opportunity.sessionId },
        data: { status: SessionStatus.SCHEDULED },
      }),
      this.prisma.auditLog.create({
        data: {
          studioId: opportunity.session.studioId,
          actorUserId,
          entityType: 'CoverOpportunity',
          entityId: id,
          action: 'COVER_CANCELLED',
          reason: 'Cover request cancelled by user',
        },
      }),
    ]);

    return { message: 'Cover request cancelled' };
  }

  async respondToOffer(
    opportunityId: string,
    instructorId: string,
    responseDto: RespondCoverOfferDto,
    actorUserId?: string,
  ) {
    const updatedOffer = await this.prisma.$transaction(async (tx) => {
      const offer = await tx.coverOffer.findUnique({
        where: { opportunityId_instructorId: { opportunityId, instructorId } },
        include: {
          opportunity: {
            include: {
              session: true,
            },
          },
        },
      });

      if (!offer) {
        throw new NotFoundException('Offer not found');
      }
      if (offer.response !== OfferResponse.PENDING) {
        throw new BadRequestException('Offer already responded to');
      }

      const session = offer.opportunity.session;
      if (session.status === SessionStatus.CANCELLED) {
        throw new BadRequestException('Session is cancelled');
      }

      const offerUpdate = await tx.coverOffer.updateMany({
        where: { id: offer.id, response: OfferResponse.PENDING },
        data: {
          response: responseDto.response as OfferResponse,
          respondedAt: new Date(),
          reason: responseDto.reason,
        },
      });
      if (offerUpdate.count === 0) {
        throw new BadRequestException('Offer already responded to');
      }

      if (responseDto.response === OfferResponse.ACCEPT) {
        const opportunityUpdate = await tx.coverOpportunity.updateMany({
          where: {
            id: opportunityId,
            status: {
              in: [OpportunityStatus.OPEN, OpportunityStatus.OFFERED],
            },
          },
          data: { status: OpportunityStatus.ASSIGNED },
        });
        if (opportunityUpdate.count === 0) {
          throw new BadRequestException('Opportunity already assigned');
        }

        const currentClassTypeId =
          session.overrideClassTypeId ?? session.baseClassTypeId;
        const compat = await this.resolveEffectiveClassTypeForCover({
          studioId: session.studioId,
          currentClassTypeId,
          instructorId,
          prisma: tx,
        });
        const newOverrideClassTypeId =
          compat.resolvedClassTypeId === session.baseClassTypeId
            ? null
            : compat.resolvedClassTypeId;

        await tx.sessionOccurrence.update({
          where: { id: session.id },
          data: {
            status: SessionStatus.COVER_ASSIGNED,
            overrideInstructorId: instructorId,
            overrideClassTypeId: newOverrideClassTypeId,
            overrideReason: compat.reason,
          },
        });

        await tx.coverOffer.updateMany({
          where: {
            opportunityId,
            id: { not: offer.id },
            response: OfferResponse.PENDING,
          },
          data: {
            response: OfferResponse.DECLINE,
            respondedAt: new Date(),
            reason: 'Opportunity assigned to another instructor',
          },
        });

        const acceptanceActorUserId = await this.resolveAcceptanceActorUserId(
          instructorId,
          actorUserId ?? offer.opportunity.requestedByUserId,
          tx,
        );

        await tx.auditLog.create({
          data: {
            studioId: session.studioId,
            actorUserId: acceptanceActorUserId,
            entityType: 'SessionOccurrence',
            entityId: session.id,
            action: 'COVER_ACCEPTED',
            reason: compat.reason,
          },
        });
      } else {
        const [pendingCount, acceptedCount] = await Promise.all([
          tx.coverOffer.count({
            where: { opportunityId, response: OfferResponse.PENDING },
          }),
          tx.coverOffer.count({
            where: { opportunityId, response: OfferResponse.ACCEPT },
          }),
        ]);

        if (acceptedCount === 0 && pendingCount === 0) {
          await tx.coverOpportunity.update({
            where: { id: opportunityId },
            data: { status: OpportunityStatus.OPEN },
          });
          await tx.sessionOccurrence.update({
            where: { id: session.id },
            data: { status: SessionStatus.NEEDS_COVER },
          });
        }
      }

      return tx.coverOffer.findUnique({
        where: { id: offer.id },
      });
    });

    if (responseDto.response === OfferResponse.ACCEPT) {
      const acceptedOffer = await this.prisma.coverOffer.findUnique({
        where: { opportunityId_instructorId: { opportunityId, instructorId } },
        include: {
          opportunity: {
            include: {
              session: {
                include: {
                  baseClassType: true,
                  overrideClassType: true,
                  week: {
                    select: {
                      status: true,
                    },
                  },
                },
              },
            },
          },
          instructor: true,
        },
      });

      if (acceptedOffer) {
        const session = acceptedOffer.opportunity.session;
        const className =
          session.baseClassType?.name || session.overrideClassType?.name || 'Class';
        const resolvedClassName =
          session.overrideClassType?.name || session.baseClassType?.name || 'Class';

        try {
          await this.notificationsService.notifyCoverAssigned({
            requesterUserId: acceptedOffer.opportunity.requestedByUserId,
            acceptedInstructorId: instructorId,
            acceptedInstructorName: acceptedOffer.instructor.fullName,
            className,
            resolvedClassName,
            startDateTimeUTC: session.startDateTimeUTC,
          });
        } catch (error) {
          console.error('Failed to create cover assignment notifications', error);
        }

        if (session.week.status === 'PUBLISHED') {
          await this.syncService.bulkEnqueueSessionSync(session.studioId, [
            session.id,
          ]);
        }
      }
    }

    return updatedOffer;
  }

  async getMyOpportunities(instructorId: string) {
    return this.prisma.coverOffer.findMany({
      where: {
        instructorId,
        response: OfferResponse.PENDING,
        opportunity: {
          status: {
            in: [OpportunityStatus.OPEN, OpportunityStatus.OFFERED],
          },
        },
      },
      include: {
        opportunity: {
          include: {
            session: {
              include: {
                baseClassType: true,
                baseInstructor: true,
              },
            },
          },
        },
      },
      orderBy: { offeredAt: 'desc' },
    });
  }
}
