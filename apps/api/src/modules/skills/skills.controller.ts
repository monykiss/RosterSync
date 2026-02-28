import { Controller, Put, Body, Param, UseGuards } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('instructors/:instructorId/skills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Put()
  @Roles(Role.ADMIN, Role.SCHEDULER)
  bulkUpdate(
    @Param('instructorId') instructorId: string,
    @Body() skills: { classTypeId: string; canTeach: boolean }[],
  ) {
    return this.skillsService.bulkUpdate(instructorId, skills);
  }
}
