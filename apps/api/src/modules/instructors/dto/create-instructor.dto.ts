import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsInt,
} from 'class-validator';

export class CreateInstructorDto {
  @IsString()
  studioId: string;

  @IsString()
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @IsOptional()
  maxWeeklySlots?: number;
}
