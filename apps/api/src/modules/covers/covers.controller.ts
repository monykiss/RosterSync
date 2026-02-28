import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { CoversService } from './covers.service';
import { RespondCoverOfferDto, CreateCoverRequestDto } from './dto/cover.dtos';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type { Request } from 'express';
import '../../common/types/request';

@Controller('opportunities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoversController {
  constructor(
    private readonly coversService: CoversService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveInstructorId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { instructorId: true },
    });
    if (!user?.instructorId) {
      throw new BadRequestException(
        'User is not linked to an instructor profile',
      );
    }
    return user.instructorId;
  }

  @Get('mine')
  @Roles(Role.INSTRUCTOR)
  async getMyOpportunities(@Req() req: Request) {
    const instructorId = await this.resolveInstructorId(req.user!.userId);
    return this.coversService.getMyOpportunities(instructorId);
  }

  @Post('request')
  @Roles(Role.INSTRUCTOR)
  createCoverRequest(@Body() dto: CreateCoverRequestDto, @Req() req: Request) {
    return this.coversService.createCoverRequest(req.user!.userId, dto);
  }

  @Get('studio/:studioId')
  @Roles(Role.ADMIN, Role.SCHEDULER)
  getStudioCoverRequests(
    @Param('studioId') studioId: string,
    @Query('status') status?: string,
  ) {
    return this.coversService.getStudioCoverRequests(studioId, status);
  }

  @Post(':id/cancel')
  @Roles(Role.INSTRUCTOR, Role.ADMIN, Role.SCHEDULER)
  cancelCoverRequest(@Param('id') id: string, @Req() req: Request) {
    return this.coversService.cancelCoverRequest(id, req.user!.userId);
  }

  @Post(':id/respond')
  @Roles(Role.INSTRUCTOR, Role.ADMIN, Role.SCHEDULER)
  async respond(
    @Param('id') id: string,
    @Body() dto: RespondCoverOfferDto,
    @Req() req: Request,
  ) {
    let instructorId: string;
    if (
      dto.instructorId &&
      (req.user!.role === 'ADMIN' || req.user!.role === 'SCHEDULER')
    ) {
      instructorId = dto.instructorId;
    } else {
      instructorId = await this.resolveInstructorId(req.user!.userId);
    }
    return this.coversService.respondToOffer(
      id,
      instructorId,
      dto,
      req.user?.userId,
    );
  }
}
