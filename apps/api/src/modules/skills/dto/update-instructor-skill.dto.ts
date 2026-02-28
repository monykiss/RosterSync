import { IsString, IsBoolean } from 'class-validator';

export class UpdateInstructorSkillDto {
  @IsString()
  instructorId: string;

  @IsString()
  classTypeId: string;

  @IsBoolean()
  canTeach: boolean;
}
