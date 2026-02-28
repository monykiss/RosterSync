import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';
import * as crypto from 'crypto';
// Prisma types inferred via query includes

@Injectable()
export class TruthDerivationService {
  constructor(private prisma: PrismaService) {}

  async deriveEffectiveSchedule(studioId: string, weekId: string) {
    const week = await this.prisma.week.findUnique({
      where: { id: weekId },
      include: {
        sessions: {
          include: {
            baseInstructor: true,
            baseClassType: true,
            overrideClassType: true,
            overrideInstructor: true,
            coverOpportunity: {
              include: {
                offers: true,
              },
            },
          },
          orderBy: { startDateTimeUTC: 'asc' },
        },
      },
    });

    if (!week) {
      throw new Error('Week not found');
    }

    // Apply precedence logic to construct effective session payload
    const effectiveSessions = week.sessions.map((session) => {
      const effectiveInstructorId =
        session.overrideInstructorId || session.baseInstructorId;
      const effectiveClassTypeId =
        session.overrideClassTypeId || session.baseClassTypeId;

      // Generate rules tracing
      let reason = 'Default Schedule';
      if (session.overrideInstructorId) {
        reason = 'Admin Override';
        if (
          session.status === 'COVER_ASSIGNED' ||
          session.coverOpportunity?.status === 'ASSIGNED'
        ) {
          reason = 'Cover Accepted';
        }
      }

      return {
        id: session.id,
        startDateTimeUTC: session.startDateTimeUTC.toISOString(),
        endDateTimeUTC: session.endDateTimeUTC.toISOString(),
        effectiveInstructorId,
        effectiveClassTypeId,
        reason,
      };
    });

    const hashPayload = JSON.stringify(effectiveSessions);
    const weekHash = crypto
      .createHash('sha256')
      .update(hashPayload)
      .digest('hex');

    return {
      weekHash,
      effectiveSessions,
    };
  }
}
