import {
  IsString,
  IsOptional,
  IsISO8601,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class GetSessionsFilterDto {
  @IsISO8601()
  startDate!: string;

  @IsISO8601()
  endDate!: string;

  @IsOptional()
  @IsString()
  instructorId?: string;
}

export class BulkUpdateSessionStatusDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sessionIds!: string[];

  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AssignInstructorDto {
  @IsString()
  @IsOptional()
  instructorId?: string;
}

export class OverrideSessionDto {
  @IsString()
  @IsOptional()
  classTypeId?: string;

  @IsString()
  @IsOptional()
  instructorId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateSessionStatusDto {
  @IsString()
  status:
    | 'SCHEDULED'
    | 'NEEDS_COVER'
    | 'COVER_PENDING'
    | 'COVER_ASSIGNED'
    | 'CANCELLED';
}
