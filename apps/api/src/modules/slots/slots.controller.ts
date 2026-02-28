import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SlotsService } from './slots.service';
import { CreateSlotTemplateDto } from './dto/create-slot-template.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('slots')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SlotsController {
  constructor(private readonly slotsService: SlotsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SCHEDULER)
  create(@Body() createSlotTemplateDto: CreateSlotTemplateDto) {
    return this.slotsService.create(createSlotTemplateDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findAll(@Query('studioId') studioId: string) {
    return this.slotsService.findAllByStudio(studioId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findOne(@Param('id') id: string) {
    return this.slotsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  update(@Param('id') id: string, @Body() dto: CreateSlotTemplateDto) {
    return this.slotsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  delete(@Param('id') id: string) {
    return this.slotsService.delete(id);
  }
}
