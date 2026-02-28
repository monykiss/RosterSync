import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '../types/request';

interface JwtTokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'demo_secret',
    });
  }

  validate(payload: JwtTokenPayload): JwtPayload {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
