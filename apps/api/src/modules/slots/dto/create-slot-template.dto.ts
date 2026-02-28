import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';

export class CreateSlotTemplateDto {
  @IsString()
  studioId: string;

  @IsString()
  name: string;

  @IsInt()
  weekday: number;

  @IsString()
  startTime: string;

  @IsInt()
  durationMins: number;

  @IsString()
  defaultClassTypeId: string;

  @IsString()
  @IsOptional()
  defaultInstructorId?: string;

  @IsString()
  @IsOptional()
  locationLabel?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
