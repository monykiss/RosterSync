import {
  createParamDecorator,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import '../types/request';

export const ActiveStudio = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const studioId = request.studioId;
    if (!studioId) {
      throw new BadRequestException(
        'Missing x-studio-id header. Select a studio first.',
      );
    }
    return studioId;
  },
);
