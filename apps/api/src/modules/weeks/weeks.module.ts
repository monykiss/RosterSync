import { Module } from '@nestjs/common';
import { WeeksController } from './weeks.controller';
import { WeeksService } from './weeks.service';
import { PrismaModule } from '../../prisma.module';
import { SyncModule } from '../sync/sync.module';
import { SessionsModule } from '../sessions/sessions.module';
import { ConflictEngine } from './conflict-engine';
import { SessionGenerationService } from './session-generation.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, SyncModule, SessionsModule, NotificationsModule],
  controllers: [WeeksController],
  providers: [WeeksService, ConflictEngine, SessionGenerationService],
  exports: [WeeksService, ConflictEngine, SessionGenerationService],
})
export class WeeksModule {}
