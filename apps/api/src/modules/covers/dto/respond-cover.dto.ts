import { IsString, IsOptional } from 'class-validator';

export class RespondCoverOfferDto {
  @IsString()
  response: 'ACCEPT' | 'DECLINE';

  @IsString()
  @IsOptional()
  reason?: string;
}
