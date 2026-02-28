import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UnavailabilityService } from './unavailability.service';
import { CreateUnavailabilityDto } from './dto/create-unavailability.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import '../../common/types/request';

@Controller('unavailability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnavailabilityController {
  constructor(private readonly unavailabilityService: UnavailabilityService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  create(@Body() createDto: CreateUnavailabilityDto, @Req() req: Request) {
    return this.unavailabilityService.create(createDto, req.user!.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SCHEDULER, Role.INSTRUCTOR)
  findAll(@Query('instructorId') instructorId: string) {
    return this.unavailabilityService.findAllByInstructor(instructorId);
  }
}
