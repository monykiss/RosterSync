import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateSlotTemplateDto } from './dto/create-slot-template.dto';

@Injectable()
export class SlotsService {
  constructor(private prisma: PrismaService) {}

  async create(createSlotTemplateDto: CreateSlotTemplateDto) {
    return this.prisma.recurringSlotTemplate.create({
      data: createSlotTemplateDto,
    });
  }

  async findAllByStudio(studioId: string) {
    return this.prisma.recurringSlotTemplate.findMany({
      where: { studioId },
      include: {
        defaultClassType: true,
        defaultInstructor: true,
      },
    });
  }

  async findOne(id: string) {
    const slot = await this.prisma.recurringSlotTemplate.findUnique({
      where: { id },
      include: {
        defaultClassType: true,
        defaultInstructor: true,
      },
    });
    if (!slot) {
      throw new NotFoundException(`Slot Template with ID ${id} not found`);
    }
    return slot;
  }

  async update(id: string, data: Partial<CreateSlotTemplateDto>) {
    await this.findOne(id);
    return this.prisma.recurringSlotTemplate.update({
      where: { id },
      data,
      include: { defaultClassType: true, defaultInstructor: true },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.recurringSlotTemplate.delete({ where: { id } });
  }
}
