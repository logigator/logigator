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
import { ModerationModule } from './moderation/moderation.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { SessionModule } from './session/session.module';
import { SharingModule } from './sharing/sharing.module';
import { StorageModule } from './storage/storage.module';
import { TextAnalysisWorkerModule } from './text-analysis/text-analysis-worker.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // The cron registry has to exist before the module holding a job is
    // constructed.
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
    ModerationModule,
    HealthModule,
    MetaModule
  ],
  // Providers rather than `useGlobalFilters`/`useGlobalPipes`, so both are
  // constructed by the container and specs get them from the module under test.
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_PIPE, useClass: ApiValidationPipe }
  ]
})
export class AppModule {
  /**
   * Root module bound to an already-validated environment. Passing the parsed
   * env in rather than letting providers read `process.env` keeps validation at
   * one bootstrap-time point and lets specs supply their own. The provider is
   * global, so a feature module injects {@link ENV} without importing anything.
   *
   * `worker: false` leaves the text analysis worker out whatever the switch
   * says, for a command-line tool that boots the container beside a running
   * server. The switch is left as configured: what it says about the listings
   * holds for the tool too.
   */
  static forEnv(
    env: Env,
    { worker = true }: { worker?: boolean } = {}
  ): DynamicModule {
    return {
      module: AppModule,
      global: true,
      // Decided here, at bootstrap, because whether the worker exists is what
      // the switch means: reads never consult it.
      imports:
        worker && env.TEXT_ANALYSIS_WORKER_ENABLED
          ? [TextAnalysisWorkerModule]
          : [],
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV]
    };
  }
}
