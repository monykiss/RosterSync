import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import '../types/request';

export const STUDIO_ID_HEADER = 'x-studio-id';

@Injectable()
export class StudioContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const studioId = req.headers[STUDIO_ID_HEADER] as string | undefined;
    if (studioId) {
      req.studioId = studioId;
    }
    next();
  }
}
