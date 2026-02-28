import { Controller, Get, HttpException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from './prisma.service';

const startedAt = new Date().toISOString();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness probe — is the process alive? Always fast. */
  @Get('health')
  healthCheck() {
    return { status: 'ok', uptime: process.uptime() };
  }

  /** Readiness probe — can the service accept traffic? Checks DB + Redis. */
  @Get('ready')
  async readinessCheck() {
    const checks: Record<string, 'ok' | 'fail'> = {};

    // Database check
    try {
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, 2000, 'Database check');
      checks.database = 'ok';
    } catch {
      checks.database = 'fail';
    }

    // Redis check
    try {
      const url = process.env.REDIS_URL;
      const redis = url
        ? new Redis(url, {
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            lazyConnect: true,
          })
        : new Redis({
            host: process.env.REDIS_HOST ?? '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
            maxRetriesPerRequest: 1,
            connectTimeout: 2000,
            lazyConnect: true,
          });
      await withTimeout(redis.connect(), 2000, 'Redis connect');
      await withTimeout(redis.ping(), 2000, 'Redis ping');
      checks.redis = 'ok';
      redis.disconnect();
    } catch {
      checks.redis = 'fail';
    }

    const ready = Object.values(checks).every((v) => v === 'ok');
    if (!ready) {
      throw new HttpException({ status: 'degraded', checks }, 503);
    }
    return { status: 'ready', checks };
  }

  /** Build/deploy metadata — git sha, version, start time. */
  @Get('version')
  versionInfo() {
    return {
      version: process.env.npm_package_version || '0.0.1',
      gitSha: process.env.GIT_SHA || 'dev',
      buildTime: process.env.BUILD_TIME || 'local',
      startedAt,
      node: process.version,
    };
  }
}
