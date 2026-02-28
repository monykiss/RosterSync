import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { TruthDerivationService } from './services/truth-derivation.service';
import { CoversModule } from '../covers/covers.module';

@Module({
  imports: [CoversModule],
  controllers: [SessionsController],
  providers: [SessionsService, TruthDerivationService],
  exports: [SessionsService, TruthDerivationService],
})
export class SessionsModule {}
