import { Controller, Get, Put, Param, UseGuards, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import '../../common/types/request';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  getMyNotifications(@Req() req: Request) {
    return this.notificationsService.getMyNotifications(req.user!.userId);
  }

  @Put(':id/read')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }
}
