import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { BulkEnqueueSyncDto } from './dto/sync.dtos';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getSyncStatus(@Query('studioId') studioId: string) {
    return this.syncService.getSyncStatus(studioId);
  }

  @Post('session/:id/enqueue')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  enqueueSync(@Param('id') id: string, @Query('studioId') studioId: string) {
    return this.syncService.enqueueSessionSync(studioId, id);
  }

  @Post('bulk-enqueue')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  bulkEnqueueSync(
    @Query('studioId') studioId: string,
    @Body() dto: BulkEnqueueSyncDto,
  ) {
    return this.syncService.bulkEnqueueSessionSync(studioId, dto.sessionIds);
  }

  @Post('job/:id/retry')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  retryJob(@Param('id') id: string) {
    return this.syncService.retryJob(id);
  }

  @Get('session/:id/history')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getSessionHistory(@Param('id') id: string) {
    return this.syncService.getSessionHistory(id);
  }

  @Get('queue/health')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getQueueHealth() {
    return this.syncService.getQueueHealth();
  }
}
