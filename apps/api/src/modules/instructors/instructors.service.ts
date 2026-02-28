import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';

@Injectable()
export class InstructorsService {
  constructor(private prisma: PrismaService) {}

  async create(createInstructorDto: CreateInstructorDto) {
    return this.prisma.instructor.create({
      data: createInstructorDto,
    });
  }

  async findAllByStudio(studioId: string) {
    return this.prisma.instructor.findMany({
      where: { studioId },
      include: {
        skills: { include: { classType: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string) {
    const instructor = await this.prisma.instructor.findUnique({
      where: { id },
      include: {
        skills: { include: { classType: true } },
      },
    });
    if (!instructor) {
      throw new NotFoundException(`Instructor with ID ${id} not found`);
    }
    return instructor;
  }

  async update(id: string, data: Partial<CreateInstructorDto>) {
    await this.findOne(id);
    return this.prisma.instructor.update({
      where: { id },
      data,
      include: { skills: { include: { classType: true } } },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.instructor.delete({ where: { id } });
  }
}
