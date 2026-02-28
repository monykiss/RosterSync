import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { UpdateInstructorSkillDto } from './dto/update-instructor-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async upsert(updateSkillDto: UpdateInstructorSkillDto) {
    const { instructorId, classTypeId, canTeach } = updateSkillDto;

    return this.prisma.instructorSkill.upsert({
      where: {
        instructorId_classTypeId: {
          instructorId,
          classTypeId,
        },
      },
      update: {
        canTeach,
      },
      create: {
        instructorId,
        classTypeId,
        canTeach,
      },
    });
  }

  async bulkUpdate(
    instructorId: string,
    skills: { classTypeId: string; canTeach: boolean }[],
  ) {
    // A real implementation would optimize this into a transaction
    return this.prisma.$transaction(
      skills.map((skill) =>
        this.prisma.instructorSkill.upsert({
          where: {
            instructorId_classTypeId: {
              instructorId,
              classTypeId: skill.classTypeId,
            },
          },
          update: {
            canTeach: skill.canTeach,
          },
          create: {
            instructorId,
            classTypeId: skill.classTypeId,
            canTeach: skill.canTeach,
          },
        }),
      ),
    );
  }
}
