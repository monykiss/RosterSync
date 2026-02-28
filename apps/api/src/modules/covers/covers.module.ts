import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { CoversService } from './covers.service';
import { CoversController } from './covers.controller';
import { CompatibilityModule } from '../compatibility/compatibility.module';
import { CoverOpportunityEngine } from './cover-engine';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [CompatibilityModule, SyncModule, NotificationsModule],
  controllers: [CoversController],
  providers: [CoversService, CoverOpportunityEngine],
  exports: [CoversService, CoverOpportunityEngine],
})
export class CoversModule {}
