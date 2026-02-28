import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';
import { OpportunityStatus, SessionStatus } from '@prisma/client';
import { CoverOpportunityEngine } from '../covers/cover-engine';
import { resolveActorUserId } from '../../common/utils/actor';

@Injectable()
export class UnavailabilityService {
  constructor(
    private prisma: PrismaService,
    private coverEngine: CoverOpportunityEngine,
  ) {}

  async create(createDto: CreateUnavailabilityDto, userId: string) {
    const actorUserId = await resolveActorUserId(this.prisma, userId);
    const start = new Date(createDto.startDateTimeUTC);
    const end = new Date(createDto.endDateTimeUTC);
    if (end <= start) {
      throw new BadRequestException(
        'endDateTimeUTC must be after startDateTimeUTC',
      );
    }

    const instructor = await this.prisma.instructor.findUnique({
      where: { id: createDto.instructorId },
      select: { studioId: true },
    });
    if (!instructor) {
      throw new BadRequestException('Instructor not found');
    }

    const unavail = await this.prisma.unavailability.create({
      data: createDto,
    });

    const conflictingSessions = await this.prisma.sessionOccurrence.findMany({
      where: {
        AND: [
          {
            status: {
              in: [SessionStatus.SCHEDULED, SessionStatus.COVER_ASSIGNED],
            },
          },
          {
            OR: [
              {
                baseInstructorId: createDto.instructorId,
                overrideInstructorId: null,
              },
              { overrideInstructorId: createDto.instructorId },
            ],
          },
          { startDateTimeUTC: { lt: new Date(createDto.endDateTimeUTC) } },
          { endDateTimeUTC: { gt: new Date(createDto.startDateTimeUTC) } },
        ],
      },
      select: { id: true },
    });

    const opportunityIds: string[] = [];

    for (const session of conflictingSessions) {
      await this.prisma.sessionOccurrence.update({
        where: { id: session.id },
        data: { status: SessionStatus.NEEDS_COVER },
      });

      const opportunity = await this.prisma.coverOpportunity.upsert({
        where: { sessionId: session.id },
        update: {
          status: OpportunityStatus.OPEN,
          requestedByUserId: actorUserId,
        },
        create: {
          sessionId: session.id,
          requestedByUserId: actorUserId,
          status: OpportunityStatus.OPEN,
        },
      });

      opportunityIds.push(opportunity.id);
    }

    for (const opportunityId of opportunityIds) {
      await this.coverEngine.generateOffersForOpportunity(opportunityId);
    }

    await this.prisma.auditLog.create({
      data: {
        studioId: instructor.studioId,
        actorUserId,
        entityType: 'Unavailability',
        entityId: unavail.id,
        action: 'UNAVAILABILITY_CREATED',
        reason: createDto.note ?? createDto.type,
        afterJson: {
          instructorId: createDto.instructorId,
          conflictsFlagged: conflictingSessions.length,
        },
      },
    });

    return {
      unavailability: unavail,
      conflictsFlagged: conflictingSessions.length,
    };
  }

  async findAllByInstructor(instructorId: string) {
    return this.prisma.unavailability.findMany({
      where: { instructorId },
      orderBy: { startDateTimeUTC: 'asc' },
    });
  }
}
