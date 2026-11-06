import { Global, Module } from '@nestjs/common';
import { Metrics } from './metrics';
import { MetricsServer } from './metrics.server';

/** The process's one {@link Metrics}, injectable everywhere. */
@Global()
@Module({
  providers: [
    { provide: Metrics, useFactory: () => new Metrics() },
    MetricsServer
  ],
  exports: [Metrics, MetricsServer]
})
export class MetricsModule {}
