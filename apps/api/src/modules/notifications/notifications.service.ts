import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { NotificationType, Role } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private formatDate(date: Date | string) {
    const value = date instanceof Date ? date : new Date(date);
    return value.toISOString().slice(0, 16).replace('T', ' ');
  }

  async create(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
      },
    });
  }

  async createMany(
    notifications: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
    }>,
  ) {
    if (notifications.length === 0) {
      return { count: 0 };
    }

    return this.prisma.notification.createMany({
      data: notifications,
    });
  }

  async getUsersByInstructorIds(instructorIds: string[]) {
    if (instructorIds.length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        instructorId: { in: instructorIds },
      },
      select: { id: true, instructorId: true },
    });
  }

  async getOperationalUsers() {
    return this.prisma.user.findMany({
      where: {
        role: {
          in: [Role.ADMIN, Role.SCHEDULER],
        },
      },
      select: { id: true },
    });
  }

  async notifyCoverOpportunity(params: {
    className: string;
    startDateTimeUTC: Date | string;
    instructorIds: string[];
  }) {
    const users = await this.getUsersByInstructorIds(params.instructorIds);
    return this.createMany(
      users.map((user) => ({
        userId: user.id,
        type: NotificationType.COVER_OPPORTUNITY,
        title: 'Cover Opportunity Available',
        body: `${params.className} on ${this.formatDate(params.startDateTimeUTC)} needs a substitute.`,
      })),
    );
  }

  async notifyCoverAssigned(params: {
    requesterUserId?: string | null;
    acceptedInstructorId: string;
    acceptedInstructorName: string;
    className: string;
    resolvedClassName?: string | null;
    startDateTimeUTC: Date | string;
  }) {
    const instructorUser = await this.prisma.user.findFirst({
      where: { instructorId: params.acceptedInstructorId },
      select: { id: true },
    });

    const sessionLabel =
      params.resolvedClassName &&
      params.resolvedClassName !== params.className
        ? `${params.className} now running as ${params.resolvedClassName}`
        : params.className;

    const notifications: Array<{
      userId: string;
      type: NotificationType;
      title: string;
      body: string;
    }> = [];

    if (params.requesterUserId) {
      notifications.push({
        userId: params.requesterUserId,
        type: NotificationType.COVER_ASSIGNED,
        title: 'Cover Assigned',
        body: `${params.acceptedInstructorName} accepted ${sessionLabel} on ${this.formatDate(params.startDateTimeUTC)}.`,
      });
    }

    if (instructorUser?.id) {
      notifications.push({
        userId: instructorUser.id,
        type: NotificationType.COVER_ASSIGNED,
        title: 'You Were Assigned',
        body: `You are covering ${sessionLabel} on ${this.formatDate(params.startDateTimeUTC)}.`,
      });
    }

    return this.createMany(notifications);
  }

  async notifyWeekPublished(params: {
    weekStartDate: Date | string;
    publishVersion: number;
  }) {
    const users = await this.getOperationalUsers();
    return this.createMany(
      users.map((user) => ({
        userId: user.id,
        type: NotificationType.SCHEDULE_PUBLISHED,
        title: 'Schedule Published',
        body: `Week of ${this.formatDate(params.weekStartDate).slice(0, 10)} was published as v${params.publishVersion}.`,
      })),
    );
  }

  async notifySyncFailed(params: {
    className?: string | null;
    errorMessage: string;
  }) {
    const users = await this.getOperationalUsers();
    const className = params.className || 'A session';
    const error = params.errorMessage.slice(0, 120);

    return this.createMany(
      users.map((user) => ({
        userId: user.id,
        type: NotificationType.SYNC_FAILED,
        title: 'Sync Failed',
        body: `${className} failed to sync. ${error}`,
      })),
    );
  }

  async getMyNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }
}
