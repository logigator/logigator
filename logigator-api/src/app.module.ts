import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ENV, type Env } from './config/env';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ApiValidationPipe } from './common/validation.pipe';
import { AuthModule } from './auth/auth.module';
import { CommunityModule } from './community/community.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MetaModule } from './meta/meta.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { SessionModule } from './session/session.module';
import { SharingModule } from './sharing/sharing.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // The one recurring job so far is the storage sweep; the cron registry has
    // to exist before the module holding it is constructed.
    ScheduleModule.forRoot(),
    DatabaseModule,
    RedisModule,
    SessionModule,
    StorageModule,
    MailModule,
    AuthModule,
    UsersModule,
    DocumentsModule,
    SharingModule,
    CommunityModule,
    ReportsModule,
    HealthModule,
    MetaModule
  ],
  // Registered as providers rather than through `useGlobalFilters`/
  // `useGlobalPipes`, so both are constructed by the container and specs get
  // them from the module under test without repeating the bootstrap wiring.
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_PIPE, useClass: ApiValidationPipe }
  ]
})
export class AppModule {
  /**
   * Root module bound to an already-validated environment. Passing the parsed
   * env in (rather than letting providers read `process.env`) keeps validation
   * at a single bootstrap-time point and lets specs supply their own
   * configuration. The provider is global so feature modules can inject
   * {@link ENV} without importing anything.
   */
  static forEnv(env: Env): DynamicModule {
    return {
      module: AppModule,
      global: true,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV]
    };
  }
}
