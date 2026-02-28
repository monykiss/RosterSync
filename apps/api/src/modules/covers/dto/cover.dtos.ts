import { IsString, IsOptional } from 'class-validator';

export class RespondCoverOfferDto {
  @IsString()
  response: 'ACCEPT' | 'DECLINE';

  @IsString()
  @IsOptional()
  instructorId?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateCoverRequestDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  urgency?: 'LOW' | 'HIGH';
}
