import { Global, Module } from '@nestjs/common';
import { Metrics } from './metrics';
import { MetricsServer } from './metrics.server';
import { DatabaseTotals } from './totals';

/** The process's one {@link Metrics}, injectable everywhere. */
@Global()
@Module({
  providers: [
    { provide: Metrics, useFactory: () => new Metrics() },
    MetricsServer,
    DatabaseTotals
  ],
  exports: [Metrics, MetricsServer]
})
export class MetricsModule {}
