import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AppController } from '../src/app.controller';
import { PrismaService } from '../src/prisma.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { StudiosController } from '../src/modules/studios/studios.controller';
import { StudiosService } from '../src/modules/studios/studios.service';
import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/auth/roles.guard';

describe('API contract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'DEMO';
    process.env.DEMO_USER_EMAIL = 'admin@rostersyncos.io';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController, AuthController, StudiosController],
      providers: [
        JwtAuthGuard,
        RolesGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn().mockResolvedValue({
              sub: 'demo-admin-user',
              email: 'admin@rostersyncos.io',
              role: 'ADMIN',
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({
              access_token: 'demo-token',
              user: {
                id: 'demo-admin-user',
                email: 'admin@rostersyncos.io',
                role: 'ADMIN',
              },
            }),
            getProfile: jest.fn().mockResolvedValue({
              id: 'demo-admin-user',
              email: 'admin@rostersyncos.io',
              role: 'ADMIN',
              instructorId: null,
              instructorName: null,
              studios: [
                {
                  id: 'studio-a',
                  name: 'Studio A - Downtown',
                  timezone: 'America/Puerto_Rico',
                },
              ],
            }),
          },
        },
        {
          provide: StudiosService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([
              {
                id: 'studio-a',
                name: 'Studio A - Downtown',
                timezone: 'America/Puerto_Rico',
                _count: { classTypes: 7, instructors: 4, slots: 6 },
              },
            ]),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    delete process.env.AUTH_MODE;
    delete process.env.DEMO_USER_EMAIL;
    await app.close();
  });

  it('GET /health returns liveness', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /version returns build metadata', async () => {
    const response = await request(app.getHttpServer()).get('/version').expect(200);
    expect(response.body.version).toBeDefined();
    expect(response.body.startedAt).toBeDefined();
  });

  it('POST /auth/login returns a token and user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@rostersyncos.io',
        password: 'Admin2026!',
      })
      .expect(200);

    expect(response.body.access_token).toBe('demo-token');
    expect(response.body.user.email).toBe('admin@rostersyncos.io');
  });

  it('GET /auth/me returns the seeded demo profile in DEMO mode', async () => {
    const response = await request(app.getHttpServer()).get('/auth/me').expect(200);

    expect(response.body.email).toBe('admin@rostersyncos.io');
    expect(response.body.studios).toHaveLength(1);
  });

  it('GET /studios returns studio records behind guards', async () => {
    const response = await request(app.getHttpServer()).get('/studios').expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'studio-a',
          name: 'Studio A - Downtown',
        }),
      ]),
    );
  });
});
