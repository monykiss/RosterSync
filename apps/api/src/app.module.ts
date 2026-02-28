import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudiosModule } from './modules/studios/studios.module';
import { ClassTypesModule } from './modules/class-types/class-types.module';
import { InstructorsModule } from './modules/instructors/instructors.module';
import { SkillsModule } from './modules/skills/skills.module';
import { CompatibilityModule } from './modules/compatibility/compatibility.module';
import { SlotsModule } from './modules/slots/slots.module';
import { WeeksModule } from './modules/weeks/weeks.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UnavailabilityModule } from './modules/unavailability/unavailability.module';
import { CoversModule } from './modules/covers/covers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SyncModule } from './modules/sync/sync.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { StudioContextMiddleware } from './common/middleware/studio-context.middleware';
import { AppController } from './app.controller';

function redisConnection() {
  const url = process.env.REDIS_URL;
  if (url) {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 1000,
      lazyConnect: true,
      retryStrategy: (times: number) => (times >= 2 ? null : 250),
    };
  }
  return {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectTimeout: 1000,
    lazyConnect: true,
    retryStrategy: (times: number) => (times >= 2 ? null : 250),
  };
}

@Module({
  controllers: [AppController],
  imports: [
    BullModule.forRoot({
      connection: redisConnection(),
    }),
    PrismaModule,
    AuthModule,
    StudiosModule,
    ClassTypesModule,
    InstructorsModule,
    SkillsModule,
    CompatibilityModule,
    SlotsModule,
    WeeksModule,
    SessionsModule,
    UnavailabilityModule,
    CoversModule,
    NotificationsModule,
    SyncModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, StudioContextMiddleware)
      .forRoutes('*');
  }
}
