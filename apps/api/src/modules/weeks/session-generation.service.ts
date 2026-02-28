import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { SessionStatus, WeekStatus } from '@prisma/client';

@Injectable()
export class SessionGenerationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Converts a local time (HH:MM) in a given IANA timezone to UTC hours/minutes
   * for a specific date. This ensures "09:00 America/Puerto_Rico" becomes "13:00 UTC".
   */
  private localTimeToUtc(date: Date, timeStr: string, timezone: string): Date {
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Build an ISO string in the target timezone, then parse as UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const h = String(hours).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');

    // Create a date string that represents this local time
    const localStr = `${year}-${month}-${day}T${h}:${m}:00`;

    // Use Intl to find the UTC offset for this timezone at this date
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Calculate offset by comparing local and UTC representations
    const utcDate = new Date(localStr + 'Z'); // treat as UTC first
    const parts = formatter.formatToParts(utcDate);
    const getPart = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);

    const localInTz = new Date(
      Date.UTC(
        getPart('year'),
        getPart('month') - 1,
        getPart('day'),
        getPart('hour'),
        getPart('minute'),
        getPart('second'),
      ),
    );

    const offsetMs = localInTz.getTime() - utcDate.getTime();

    // The actual UTC time = local time - offset
    const result = new Date(`${localStr}Z`);
    result.setTime(result.getTime() - offsetMs);
    return result;
  }

  async generateWeekSessions(studioId: string, weekStartDate: string) {
    const startDate = new Date(weekStartDate);

    // Fetch studio timezone
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: { timezone: true },
    });
    const timezone = studio?.timezone ?? 'UTC';

    let week = await this.prisma.week.findFirst({
      where: { studioId, weekStartDate: startDate },
    });

    if (!week) {
      week = await this.prisma.week.create({
        data: {
          studioId,
          weekStartDate: startDate,
          status: WeekStatus.DRAFT,
        },
      });
    } else if (week.status === WeekStatus.PUBLISHED) {
      throw new ConflictException('Week is already published');
    }

    const templates = await this.prisma.recurringSlotTemplate.findMany({
      where: { studioId, isActive: true },
    });

    if (templates.length === 0) {
      throw new BadRequestException(
        'No active slot templates found for this studio. Create recurring slot templates before generating a week.',
      );
    }

    const sessionsData = [];

    for (const template of templates) {
      const sessionDate = new Date(startDate);
      // weekday: 0=Sun, 1=Mon, ..., 6=Sat. Week starts on Monday.
      // Monday=1 -> offset 0, Tue=2 -> offset 1, ..., Sun=0 -> offset 6
      const offset = template.weekday === 0 ? 6 : template.weekday - 1;
      sessionDate.setUTCDate(sessionDate.getUTCDate() + offset);

      // Convert local studio time to UTC
      const startDateTimeUTC = this.localTimeToUtc(
        sessionDate,
        template.startTime,
        timezone,
      );

      const endDateTimeUTC = new Date(startDateTimeUTC);
      endDateTimeUTC.setUTCMinutes(
        endDateTimeUTC.getUTCMinutes() + template.durationMins,
      );

      sessionsData.push({
        studioId,
        weekId: week.id,
        slotTemplateId: template.id,
        sessionDate,
        startDateTimeUTC,
        endDateTimeUTC,
        status: SessionStatus.SCHEDULED,
        baseClassTypeId: template.defaultClassTypeId,
        baseInstructorId: template.defaultInstructorId,
      });
    }

    // Upsert sessions to be idempotent
    const createdSessions = await Promise.all(
      sessionsData.map((data) =>
        this.prisma.sessionOccurrence.upsert({
          where: {
            slotTemplateId_startDateTimeUTC: {
              slotTemplateId: data.slotTemplateId,
              startDateTimeUTC: data.startDateTimeUTC,
            },
          },
          update: {},
          create: data,
        }),
      ),
    );

    return { week, sessionsCreated: createdSessions.length };
  }
}
