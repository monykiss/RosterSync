import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateClassTypeDto {
  @IsString()
  studioId: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
