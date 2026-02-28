import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateCompatibilityRuleDto } from './dto/create-compatibility-rule.dto';

@Injectable()
export class CompatibilityService {
  constructor(private prisma: PrismaService) {}

  async create(createRuleDto: CreateCompatibilityRuleDto) {
    return this.prisma.compatibilityRule.create({
      data: createRuleDto,
    });
  }

  async findAllByStudio(studioId: string) {
    return this.prisma.compatibilityRule.findMany({
      where: { studioId },
      include: {
        fromClassType: true,
        toClassType: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.compatibilityRule.delete({
      where: { id },
    });
  }
}
