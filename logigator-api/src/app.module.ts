import { type DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ENV, type Env } from './config/env';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MetaModule } from './meta/meta.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule, HealthModule, MetaModule],
  // Registered as a provider rather than through `useGlobalFilters`, so the
  // filter is constructed by the container and specs get it from the module
  // under test without repeating the bootstrap wiring.
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }]
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
