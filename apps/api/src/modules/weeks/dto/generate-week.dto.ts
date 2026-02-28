import { IsString, IsDateString } from 'class-validator';

export class GenerateWeekDto {
  @IsString()
  studioId: string;

  @IsDateString()
  weekStartDate: string;
}
