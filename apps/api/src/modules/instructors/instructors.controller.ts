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
import { InstructorsService } from './instructors.service';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('instructors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstructorsController {
  constructor(private readonly instructorsService: InstructorsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SCHEDULER)
  create(@Body() createInstructorDto: CreateInstructorDto) {
    return this.instructorsService.create(createInstructorDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findAll(@Query('studioId') studioId: string) {
    return this.instructorsService.findAllByStudio(studioId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findOne(@Param('id') id: string) {
    return this.instructorsService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: CreateInstructorDto) {
    return this.instructorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.instructorsService.delete(id);
  }
}
