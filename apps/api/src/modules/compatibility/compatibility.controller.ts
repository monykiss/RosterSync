import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
  Delete,
} from '@nestjs/common';
import { CompatibilityService } from './compatibility.service';
import { CreateCompatibilityRuleDto } from './dto/create-compatibility-rule.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('compatibility-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompatibilityController {
  constructor(private readonly compatibilityService: CompatibilityService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SCHEDULER)
  create(@Body() createRuleDto: CreateCompatibilityRuleDto) {
    return this.compatibilityService.create(createRuleDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER)
  findAll(@Query('studioId') studioId: string) {
    return this.compatibilityService.findAllByStudio(studioId);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  delete(@Param('id') id: string) {
    return this.compatibilityService.delete(id);
  }
}
