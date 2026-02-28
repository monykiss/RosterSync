import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { isObservable, lastValueFrom } from 'rxjs';
import type { Request } from 'express';
import '../types/request';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    if (process.env.AUTH_MODE === 'DEMO') {
      const request = context.switchToHttp().getRequest<Request>();
      const authHeader = request.headers.authorization;
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

      if (token) {
        try {
          const payload = await this.jwtService.verifyAsync<{
            sub: string;
            email: string;
            role: string;
          }>(token);
          request.user = {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
          };
          return true;
        } catch {
          throw new UnauthorizedException('Invalid token');
        }
      }

      request.user = {
        userId: 'demo-admin-user',
        email: process.env.DEMO_USER_EMAIL ?? 'admin@rostersyncos.io',
        role: 'ADMIN',
      };
      return true;
    }
    const result = super.canActivate(context);
    if (typeof result === 'boolean') {
      return result;
    }
    if (isObservable(result)) {
      return lastValueFrom(result);
    }
    return result;
  }
}
