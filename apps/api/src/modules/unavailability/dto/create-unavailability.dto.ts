import { IsDateString, IsString, IsOptional, IsEnum } from 'class-validator';
import { UnavailabilityType } from '@prisma/client';

export class CreateUnavailabilityDto {
  @IsString()
  instructorId: string;

  @IsDateString()
  startDateTimeUTC: string;

  @IsDateString()
  endDateTimeUTC: string;

  @IsEnum(UnavailabilityType)
  type: UnavailabilityType;

  @IsString()
  @IsOptional()
  note?: string;
}
