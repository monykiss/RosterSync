import { IsString, IsOptional } from 'class-validator';

export class CreateStudioDto {
  @IsString()
  name: string;

  @IsString()
  timezone: string;

  @IsString()
  @IsOptional()
  wixSiteId?: string;

  @IsString()
  @IsOptional()
  wixAccountId?: string;
}
