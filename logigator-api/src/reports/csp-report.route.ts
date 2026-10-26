import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyInstance } from 'fastify';
import type { Env } from '../config/env';
import { RedisService } from '../redis/redis.service';
import { CspReportLog } from './csp-report-log';

export const CSP_REPORT_PATH = '/api/csp-report';

/** `report-uri`'s type and the Reporting API's. */
const CSP_REPORT_TYPES = ['application/csp-report', 'application/reports+json'];

/** A full Reporting API batch is a few kilobytes. */
export const CSP_REPORT_MAX_BYTES = 16 * 1024;

const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent'
] as const;

/**
 * `POST /api/csp-report`, where browsers send the policies' violation reports.
 * Unauthenticated and written by anyone, so it reads as little as it can:
 * only its two content types, at most {@link CSP_REPORT_MAX_BYTES}, and
 * {@link CspReportLog} decides what reaches the log.
 *
 * A Fastify route in a plugin of its own rather than a controller, because a
 * content-type parser applies to every route of the instance it is added to:
 * here it is this route's alone. Every answer but the framework's 413 and 415
 * is an empty `204`, so a sender learns nothing about what was kept.
 *
 * It never opens a session, and its level is at least `warn`: Fastify's
 * per-request lines carry the address, and would log every report the limits
 * hold back.
 */
export async function registerCspReportRoute(
  app: NestFastifyApplication,
  env: Env
): Promise<void> {
  const redis = app.get(RedisService);

  await app.register(async (instance: FastifyInstance) => {
    const reports = new CspReportLog(redis, instance.log);
    const parseJson = instance.getDefaultJsonParser('remove', 'remove');

    instance.removeAllContentTypeParsers();
    instance.addContentTypeParser(
      CSP_REPORT_TYPES,
      { parseAs: 'string', bodyLimit: CSP_REPORT_MAX_BYTES },
      (request, body, done) => {
        parseJson(request, body.toString(), (error, value) =>
          done(null, error ? undefined : value)
        );
      }
    );

    instance.post(
      CSP_REPORT_PATH,
      {
        bodyLimit: CSP_REPORT_MAX_BYTES,
        logLevel:
          LOG_LEVELS[
            Math.max(
              LOG_LEVELS.indexOf(env.LOG_LEVEL),
              LOG_LEVELS.indexOf('warn')
            )
          ],
        config: { sessionless: true },
        errorHandler: (error, request, reply) => {
          const status = (error as { statusCode?: unknown }).statusCode;
          if (typeof status === 'number' && status >= 400 && status < 500) {
            return reply.code(status).send();
          }
          request.log.error(
            { route: CSP_REPORT_PATH, err: error },
            'request failed'
          );
          return reply.code(500).send();
        }
      },
      async (request, reply) => {
        await reports.receive(
          request.body,
          request.ip,
          request.headers['user-agent'],
          request.log
        );
        return reply.code(204).send();
      }
    );
  });
}
