import { IsString, IsInt, IsBoolean, IsOptional } from 'class-validator';

export class CreateCompatibilityRuleDto {
  @IsString()
  studioId: string;

  @IsString()
  fromClassTypeId: string;

  @IsString()
  toClassTypeId: string;

  @IsInt()
  priority: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @IsString()
  @IsOptional()
  reasonTemplate?: string;
}
