import { createServer, type Server } from 'node:http';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown
} from '@nestjs/common';
import type { Pool } from 'pg';
import { collectDefaultMetrics } from '@prometheus-io/client';
import manifest from '../../../package.json';
import { ENV, type Env } from '../config/env';
import { PG_POOL } from '../database/database.module';
import { Metrics } from './metrics';
import { DatabaseTotals } from './totals';

/**
 * `GET /metrics` on `METRICS_PORT`, a listener of its own that no proxy route
 * reaches. Only the server's entry point starts it: the command-line tools
 * boot the same container, often beside a running server holding the port.
 */
@Injectable()
export class MetricsServer implements OnApplicationShutdown {
  private readonly logger = new Logger('Metrics');
  private server: Server | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly metrics: Metrics,
    private readonly totals: DatabaseTotals
  ) {}

  /** Listens on `METRICS_PORT`; does nothing when it is unset. */
  async start(): Promise<void> {
    const port = this.env.METRICS_PORT;
    if (port === undefined || this.server) return;

    const { registry } = this.metrics;
    collectDefaultMetrics({ register: registry });
    this.metrics.buildInfo.set({ version: manifest.version }, 1);
    this.metrics.observePool(() => ({
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount
    }));

    const server = createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/metrics') {
        response.writeHead(404).end();
        return;
      }
      this.totals
        .refresh()
        .then(() => registry.metrics())
        .then(
          (body) => {
            response.writeHead(200, { 'Content-Type': registry.contentType });
            response.end(body);
          },
          (error: unknown) => {
            this.logger.error(error);
            response.writeHead(500).end();
          }
        );
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, this.env.HOST, () => {
        server.off('error', reject);
        resolve();
      });
    });
    this.server = server;
    this.logger.log(`Serving /metrics on port ${port}`);
  }

  async onApplicationShutdown(): Promise<void> {
    const server = this.server;
    if (!server) return;
    this.server = null;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
