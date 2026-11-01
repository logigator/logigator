import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { TurnstileAction } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { ENV, type Env } from '../config/env';

export const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** The `fetch` siteverify is called through, so specs never reach Cloudflare. */
export const TURNSTILE_FETCH = Symbol('TURNSTILE_FETCH');

const SITEVERIFY_TIMEOUT_MS = 5000;

/**
 * Error codes that describe this server's request rather than the visitor's
 * token. A refusal for one of them is a configuration fault, answered as an
 * outage instead of blaming the visitor.
 */
const SERVER_FAULTS = new Set([
  'missing-input-secret',
  'invalid-input-secret',
  'bad-request',
  'internal-error'
]);

interface SiteverifyReply {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
  'error-codes'?: unknown;
}

/**
 * Checks a Turnstile token against Cloudflare before a route that mails or
 * stores something for an anonymous caller does anything. Without
 * `TURNSTILE_SECRET_KEY` the check is off and every token, or none, passes.
 *
 * A token counts only when Cloudflare accepts it, it was solved on this
 * site's host, and under the action of the form the route serves.
 */
@Injectable()
export class TurnstileService {
  private readonly logger = new Logger('Turnstile');
  private readonly secret: string | undefined;
  private readonly hostname: string;

  constructor(
    @Inject(ENV) env: Env,
    @Inject(TURNSTILE_FETCH) private readonly fetch: typeof globalThis.fetch
  ) {
    this.secret = env.TURNSTILE_SECRET_KEY;
    this.hostname = new URL(env.PUBLIC_URL).hostname;
  }

  async verify(
    token: string | undefined,
    action: TurnstileAction,
    ip: string
  ): Promise<void> {
    if (!this.secret) return;
    if (!token) throw challengeFailed();

    const reply = await this.siteverify(token, ip);
    const errorCodes = Array.isArray(reply['error-codes'])
      ? reply['error-codes'].map(String)
      : [];
    if (errorCodes.some((code) => SERVER_FAULTS.has(code))) {
      this.logger.error(
        `siteverify refused the request: ${errorCodes.join(', ')}`
      );
      throw unavailable();
    }

    if (
      reply.success !== true ||
      reply.hostname !== this.hostname ||
      reply.action !== action
    ) {
      this.logger.debug(
        `Challenge refused for ${action}: ${JSON.stringify({
          success: reply.success,
          hostname: reply.hostname,
          action: reply.action,
          errorCodes
        })}`
      );
      throw challengeFailed();
    }
  }

  private async siteverify(
    token: string,
    ip: string
  ): Promise<SiteverifyReply> {
    try {
      const response = await this.fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secret,
          response: token,
          remoteip: ip
        }),
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reply: unknown = await response.json();
      if (typeof reply !== 'object' || reply === null) {
        throw new Error('the reply is not an object');
      }
      return reply as SiteverifyReply;
    } catch (error) {
      this.logger.error('siteverify could not be reached', error);
      throw unavailable();
    }
  }
}

function challengeFailed(): ApiException {
  return new ApiException(
    HttpStatus.BAD_REQUEST,
    'challenge_failed',
    'The security check did not succeed. Please try again.'
  );
}

function unavailable(): ApiException {
  return new ApiException(
    HttpStatus.SERVICE_UNAVAILABLE,
    'service_unavailable',
    'The security check is unavailable. Please try again later.'
  );
}
