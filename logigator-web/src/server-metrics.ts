import { createServer, type Server } from 'node:http';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry
} from '@prometheus-io/client';
import type { RequestHandler, Response } from 'express';
import type { ServerFailure } from './server-log';

/**
 * In seconds. Metrics outlive the logs' raw durations, so these bounds are
 * the long-term resolution of latency.
 */
const DURATION_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/** What a response is counted under when no handler named its route. */
const UNMATCHED = 'unmatched';

/**
 * Names the route a response answers for. A name is a template or a fixed
 * word the code owns, never a raw path: every one is a series kept forever.
 */
export function nameRoute(res: Response, route: string): void {
  res.locals['route'] = route;
}

function routeOf(res: Response): string {
  const route: unknown = res.locals['route'];
  return typeof route === 'string' ? route : UNMATCHED;
}

/** Every metric the site's server writes, on a registry of its own. */
export class ServerMetrics {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'logigator_http_requests_total',
    help: 'Requests answered, by route template, method and status.',
    labelNames: ['route', 'method', 'status'] as const,
    registers: [this.registry]
  });

  readonly httpRequestDuration = new Histogram({
    name: 'logigator_http_request_duration_seconds',
    help: 'Time from receiving a request to finishing its response.',
    labelNames: ['route', 'method'] as const,
    buckets: DURATION_BUCKETS,
    registers: [this.registry]
  });

  readonly renderErrors = new Counter({
    name: 'logigator_render_errors_total',
    help: 'Errors a render caught and survived.',
    registers: [this.registry]
  });

  readonly processFailures = new Counter({
    name: 'logigator_process_failures_total',
    help: 'Failures no request owns, by kind (unhandled_rejection, uncaught_exception).',
    labelNames: ['kind'] as const,
    registers: [this.registry]
  });

  readonly buildInfo = new Gauge({
    name: 'logigator_build_info',
    help: 'The running build, always 1.',
    labelNames: ['version'] as const,
    registers: [this.registry]
  });

  /** Counts one failure the log wrote. */
  countFailure(failure: ServerFailure): void {
    if (failure === 'render_error') this.renderErrors.inc();
    else this.processFailures.inc({ kind: failure });
  }

  /** Counts and times every response once it is sent, under its route's name. */
  requestRecorder(): RequestHandler {
    return (req, res, next) => {
      const start = performance.now();
      res.on('finish', () => {
        const route = routeOf(res);
        const method = req.method;
        this.httpRequests.inc({
          route,
          method,
          status: String(res.statusCode)
        });
        this.httpRequestDuration.observe(
          { route, method },
          (performance.now() - start) / 1000
        );
      });
      next();
    };
  }

  /**
   * Serves `GET /metrics` on `port`, a listener no proxy route reaches, and
   * starts the process metrics with it.
   */
  listen(port: number, version: string): Server {
    collectDefaultMetrics({ register: this.registry });
    this.buildInfo.set({ version }, 1);
    for (const kind of ['unhandled_rejection', 'uncaught_exception']) {
      this.processFailures.inc({ kind }, 0);
    }
    const registry = this.registry;
    return createServer((request, response) => {
      if (request.method !== 'GET' || request.url !== '/metrics') {
        response.writeHead(404).end();
        return;
      }
      registry.metrics().then(
        (body) => {
          response.writeHead(200, { 'Content-Type': registry.contentType });
          response.end(body);
        },
        () => response.writeHead(500).end()
      );
    }).listen(port);
  }
}
