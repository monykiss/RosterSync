import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateStudioDto } from './dto/create-studio.dto';

@Injectable()
export class StudiosService {
  constructor(private prisma: PrismaService) {}

  async create(createStudioDto: CreateStudioDto) {
    return this.prisma.studio.create({
      data: createStudioDto,
    });
  }

  async findAll() {
    return this.prisma.studio.findMany({
      include: {
        _count: {
          select: { classTypes: true, instructors: true, slots: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${id} not found`);
    }
    return studio;
  }

  async update(id: string, data: Partial<CreateStudioDto>) {
    await this.findOne(id);
    return this.prisma.studio.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.studio.delete({ where: { id } });
  }
}
