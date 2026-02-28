import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { WeeksService } from './weeks.service';
import { GenerateWeekDto } from './dto/generate-week.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import '../../common/types/request';

@Controller('weeks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WeeksController {
  constructor(private readonly weeksService: WeeksService) {}

  @Post('generate')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  generateWeek(@Body() generateWeekDto: GenerateWeekDto) {
    return this.weeksService.generateWeek(generateWeekDto);
  }

  @Get('dashboard-stats')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getDashboardStats(@Req() req: Request) {
    if (!req.studioId) return { totalSessions: 0, fillRate: 0, needsCover: 0, cancelled: 0, syncRate: 100, syncFailed: 0, activeInstructors: 0 };
    return this.weeksService.getDashboardStats(req.studioId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findAll(@Req() req: Request) {
    return this.weeksService.findAll(req.studioId);
  }

  @Get(':id/planner')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  getPlanner(@Param('id') id: string) {
    return this.weeksService.getPlanner(id);
  }

  @Get(':id/prepublish-check')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  prepublishCheck(@Param('id') id: string) {
    return this.weeksService.prepublishCheck(id);
  }

  @Get(':id/versions')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getVersionHistory(@Param('id') id: string) {
    return this.weeksService.getVersionHistory(id);
  }

  @Get(':id/diff')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getVersionDiff(
    @Param('id') id: string,
    @Query('version') version: string,
  ) {
    return this.weeksService.getVersionDiff(id, parseInt(version, 10) || 1);
  }

  @Post(':id/publish')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  publish(
    @Param('id') id: string,
    @Body() body: { force?: boolean },
    @Req() req: Request,
  ) {
    return this.weeksService.publish(
      id,
      req.user!.userId,
      req.correlationId,
      body.force === true,
    );
  }
}
