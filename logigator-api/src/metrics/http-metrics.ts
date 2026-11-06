import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { Metrics } from './metrics';

/** The contract error code each failed request was answered with. */
const errorCodes = new WeakMap<FastifyRequest, string>();

/** Notes the code `ApiExceptionFilter` answered a request with. */
export function recordErrorCode(request: FastifyRequest, code: string): void {
  errorCodes.set(request, code);
}

/** The matched route's template, or `unmatched`. */
export function routeLabel(request: FastifyRequest): string {
  return request.routeOptions.url ?? 'unmatched';
}

/**
 * Counts and times every answered request, plain Fastify routes included. A
 * request is in flight until its response closes, answered or abandoned.
 */
export function registerHttpMetrics(app: NestFastifyApplication): void {
  const metrics = app.get(Metrics);
  const instance = app.getHttpAdapter().getInstance();

  instance.addHook('onRequest', (request, reply, done) => {
    metrics.httpRequestsInFlight.inc();
    reply.raw.once('close', () => metrics.httpRequestsInFlight.dec());
    done();
  });

  instance.addHook(
    'onResponse',
    (request: FastifyRequest, reply: FastifyReply, done) => {
      const route = routeLabel(request);
      const method = request.method;
      metrics.httpRequests.inc({
        route,
        method,
        status: String(reply.statusCode),
        code: errorCodes.get(request) ?? ''
      });
      metrics.httpRequestDuration.observe(
        { route, method },
        reply.elapsedTime / 1000
      );
      done();
    }
  );
}
