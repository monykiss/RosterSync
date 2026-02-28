import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateClassTypeDto } from './dto/create-class-type.dto';

@Injectable()
export class ClassTypesService {
  constructor(private prisma: PrismaService) {}

  async create(createClassTypeDto: CreateClassTypeDto) {
    return this.prisma.classType.create({
      data: createClassTypeDto,
    });
  }

  async findAllByStudio(studioId: string) {
    return this.prisma.classType.findMany({
      where: { studioId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const classType = await this.prisma.classType.findUnique({
      where: { id },
    });
    if (!classType) {
      throw new NotFoundException(`Class Type with ID ${id} not found`);
    }
    return classType;
  }

  async update(id: string, data: Partial<CreateClassTypeDto>) {
    await this.findOne(id);
    return this.prisma.classType.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.classType.delete({ where: { id } });
  }
}
