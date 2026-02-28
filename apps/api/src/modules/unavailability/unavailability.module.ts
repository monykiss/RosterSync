import { Module } from '@nestjs/common';
import { UnavailabilityService } from './unavailability.service';
import { UnavailabilityController } from './unavailability.controller';
import { CoversModule } from '../covers/covers.module';

@Module({
  imports: [CoversModule],
  controllers: [UnavailabilityController],
  providers: [UnavailabilityService],
  exports: [UnavailabilityService],
})
export class UnavailabilityModule {}
