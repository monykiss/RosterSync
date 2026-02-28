import { Module } from '@nestjs/common';
import { ClassTypesService } from './class-types.service';
import { ClassTypesController } from './class-types.controller';

@Module({
  controllers: [ClassTypesController],
  providers: [ClassTypesService],
  exports: [ClassTypesService],
})
export class ClassTypesModule {}
