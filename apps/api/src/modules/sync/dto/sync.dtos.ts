import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';

export class BulkEnqueueSyncDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sessionIds!: string[];
}
