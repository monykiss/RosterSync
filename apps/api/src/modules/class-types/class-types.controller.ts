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
import { ClassTypesService } from './class-types.service';
import { CreateClassTypeDto } from './dto/create-class-type.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('class-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassTypesController {
  constructor(private readonly classTypesService: ClassTypesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() createClassTypeDto: CreateClassTypeDto) {
    return this.classTypesService.create(createClassTypeDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findAll(@Query('studioId') studioId: string) {
    return this.classTypesService.findAllByStudio(studioId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findOne(@Param('id') id: string) {
    return this.classTypesService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: CreateClassTypeDto) {
    return this.classTypesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.classTypesService.delete(id);
  }
}
