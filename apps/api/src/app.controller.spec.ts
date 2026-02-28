import { HttpException } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaService } from './prisma.service';

// Mock ioredis to avoid real connections in tests
const mockRedis = {
  connect: jest.fn(),
  ping: jest.fn(),
  disconnect: jest.fn(),
};
jest.mock('ioredis', () => {
  return jest.fn(() => mockRedis);
});

describe('AppController', () => {
  let controller: AppController;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      $queryRaw: jest.fn(),
    } as any;
    controller = new AppController(prisma);
  });

  describe('GET /health', () => {
    it('returns status ok with uptime', () => {
      const result = controller.healthCheck();
      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
    });
  });

  describe('GET /version', () => {
    it('returns version metadata', () => {
      const result = controller.versionInfo();
      expect(result.version).toBeDefined();
      expect(result.gitSha).toBeDefined();
      expect(result.startedAt).toBeDefined();
      expect(result.node).toMatch(/^v\d+/);
    });
  });

  describe('GET /ready', () => {
    it('returns ready when DB and Redis are reachable', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue('PONG');

      const result = await controller.readinessCheck();
      expect(result.status).toBe('ready');
      expect(result.checks.database).toBe('ok');
      expect(result.checks.redis).toBe('ok');
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('throws 503 when DB is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.ping.mockResolvedValue('PONG');

      try {
        await controller.readinessCheck();
        fail('Expected HttpException');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const body = (e as HttpException).getResponse() as any;
        expect(body.status).toBe('degraded');
        expect(body.checks.database).toBe('fail');
        expect(body.checks.redis).toBe('ok');
      }
    });

    it('throws 503 when Redis is unreachable', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockRedis.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      try {
        await controller.readinessCheck();
        fail('Expected HttpException');
      } catch (e) {
        expect(e).toBeInstanceOf(HttpException);
        const body = (e as HttpException).getResponse() as any;
        expect(body.status).toBe('degraded');
        expect(body.checks.database).toBe('ok');
        expect(body.checks.redis).toBe('fail');
      }
    });
  });
});
