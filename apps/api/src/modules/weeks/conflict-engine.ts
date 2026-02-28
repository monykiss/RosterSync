import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { InstructorSkill, Unavailability } from '@prisma/client';

export type ConflictSeverity = 'CRITICAL' | 'WARNING';

export interface SessionConflict {
  sessionId: string;
  type:
    | 'UNAVAILABLE'
    | 'DOUBLE_BOOKED'
    | 'SKILL_MISMATCH'
    | 'MAX_LOAD_EXCEEDED'
    | 'UNASSIGNED';
  message: string;
  severity: ConflictSeverity;
}

@Injectable()
export class ConflictEngine {
  constructor(private prisma: PrismaService) {}

  async evaluateWeekConflicts(
    studioId: string,
    weekId: string,
  ): Promise<SessionConflict[]> {
    const sessions = await this.prisma.sessionOccurrence.findMany({
      where: { studioId, weekId },
      include: {
        baseInstructor: true,
        overrideInstructor: true,
      },
    });

    const conflicts: SessionConflict[] = [];

    // Group by instructor for double booking and load checking
    const instructorSessions = new Map<string, typeof sessions>();

    // Get all skills for instructors in this week
    const instructorIds = [
      ...new Set(
        sessions
          .map((s) => s.overrideInstructorId || s.baseInstructorId)
          .filter(Boolean),
      ),
    ] as string[];

    const [unavailabilities, skills] = await Promise.all([
      this.prisma.unavailability.findMany({
        where: {
          instructorId: { in: instructorIds },
        }, // Ideally filter by dates matching the week
      }),
      this.prisma.instructorSkill.findMany({
        where: { instructorId: { in: instructorIds } },
      }),
    ]);

    for (const session of sessions) {
      const effectiveInstructorId =
        session.overrideInstructorId || session.baseInstructorId;
      const effectiveClassTypeId =
        session.overrideClassTypeId || session.baseClassTypeId;

      if (!effectiveInstructorId) {
        conflicts.push({
          sessionId: session.id,
          type: 'UNASSIGNED',
          message: 'Session has no assigned instructor.',
          severity: 'CRITICAL',
        });
        continue; // No further checks if unassigned
      }

      // Check skill mismatch
      const hasSkill = skills.find(
        (s: InstructorSkill) =>
          s.instructorId === effectiveInstructorId &&
          s.classTypeId === effectiveClassTypeId &&
          s.canTeach,
      );
      if (!hasSkill) {
        conflicts.push({
          sessionId: session.id,
          type: 'SKILL_MISMATCH',
          message: 'Instructor cannot teach this class type.',
          severity: 'CRITICAL',
        });
      }

      // Check unavailability overlap
      const isUnavailable = unavailabilities.some(
        (u: Unavailability) =>
          u.instructorId === effectiveInstructorId &&
          ((session.startDateTimeUTC >= u.startDateTimeUTC &&
            session.startDateTimeUTC < u.endDateTimeUTC) ||
            (session.endDateTimeUTC > u.startDateTimeUTC &&
              session.endDateTimeUTC <= u.endDateTimeUTC)),
      );

      if (isUnavailable) {
        conflicts.push({
          sessionId: session.id,
          type: 'UNAVAILABLE',
          message:
            'Instructor is explicitly marked unavailable during this time.',
          severity: 'CRITICAL',
        });
      }

      // Group for double booking
      if (!instructorSessions.has(effectiveInstructorId)) {
        instructorSessions.set(effectiveInstructorId, []);
      }
      instructorSessions.get(effectiveInstructorId)!.push(session);
    }

    // Fetch instructor max loads
    const instructorsWithLimits = await this.prisma.instructor.findMany({
      where: { id: { in: instructorIds } },
      select: { id: true, maxWeeklySlots: true },
    });
    const maxLoadMap = new Map(
      instructorsWithLimits.map((i) => [i.id, i.maxWeeklySlots]),
    );

    // Check double bookings and max load
    for (const [instructorId, instSessions] of instructorSessions.entries()) {
      // Sort by start time
      instSessions.sort(
        (a, b) => a.startDateTimeUTC.getTime() - b.startDateTimeUTC.getTime(),
      );

      for (let i = 0; i < instSessions.length - 1; i++) {
        const current = instSessions[i];
        const next = instSessions[i + 1];

        if (current.endDateTimeUTC > next.startDateTimeUTC) {
          conflicts.push({
            sessionId: current.id,
            type: 'DOUBLE_BOOKED',
            message: 'Instructor is double-booked.',
            severity: 'CRITICAL',
          });
          conflicts.push({
            sessionId: next.id,
            type: 'DOUBLE_BOOKED',
            message: 'Instructor is double-booked.',
            severity: 'CRITICAL',
          });
        }
      }

      // Max load — use the instructor's configured maxWeeklySlots
      const maxSlots = maxLoadMap.get(instructorId) ?? 15;
      if (instSessions.length > maxSlots) {
        instSessions.forEach((s) => {
          conflicts.push({
            sessionId: s.id,
            type: 'MAX_LOAD_EXCEEDED',
            message: `Instructor exceeds weekly limit (${instSessions.length}/${maxSlots} slots).`,
            severity: 'WARNING',
          });
        });
      }
    }

    return conflicts;
  }
}
