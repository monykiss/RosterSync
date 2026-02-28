import {
  Controller,
  Put,
  Patch,
  Get,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SessionsService } from './sessions.service';
import {
  AssignInstructorDto,
  OverrideSessionDto,
  UpdateSessionStatusDto,
  GetSessionsFilterDto,
  BulkUpdateSessionStatusDto,
} from './dto/session.dtos';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import '../../common/types/request';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  getSessions(
    @Query('studioId') studioId: string,
    @Query() filters: GetSessionsFilterDto,
  ) {
    return this.sessionsService.getSessions(studioId, filters);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  getSessionById(@Param('id') id: string) {
    return this.sessionsService.getSessionById(id);
  }

  @Patch('bulk-status')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  bulkUpdateStatus(
    @Query('studioId') studioId: string,
    @Body() dto: BulkUpdateSessionStatusDto,
    @Req() req: Request,
  ) {
    return this.sessionsService.bulkUpdateStatus(
      studioId,
      dto,
      req.user?.userId,
    );
  }

  @Put(':id/assign')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  assignInstructor(
    @Param('id') id: string,
    @Body() assignDto: AssignInstructorDto,
    @Req() req: Request,
  ) {
    return this.sessionsService.assignInstructor(
      id,
      assignDto,
      req.user?.userId,
    );
  }

  @Put(':id/override')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  overrideSession(
    @Param('id') id: string,
    @Body() overrideDto: OverrideSessionDto,
    @Req() req: Request,
  ) {
    return this.sessionsService.overrideSession(
      id,
      overrideDto,
      req.user?.userId,
    );
  }

  @Put(':id/status')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  updateStatus(
    @Param('id') id: string,
    @Body() statusDto: UpdateSessionStatusDto,
    @Req() req: Request,
  ) {
    return this.sessionsService.updateStatus(id, statusDto, req.user?.userId);
  }

  @Get(':id/audit')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getSessionAuditTrail(@Param('id') id: string) {
    return this.sessionsService.getSessionAuditTrail(id);
  }

  @Get(':id/detail')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  getSessionDetail(@Param('id') id: string) {
    return this.sessionsService.getSessionDetail(id);
  }
}
