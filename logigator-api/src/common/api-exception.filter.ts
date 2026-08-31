import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { ApiError, ApiErrorCode } from '@logigator/contract';
import { ApiException } from './api-exception';

/**
 * Codes for the statuses that have a distinct meaning to a client. Anything
 * else collapses: a remaining 4xx to `bad_request`, every 5xx to `internal`.
 */
const CODE_BY_STATUS = new Map<number, ApiErrorCode>([
  [HttpStatus.BAD_REQUEST, 'bad_request'],
  [HttpStatus.UNAUTHORIZED, 'unauthorized'],
  [HttpStatus.FORBIDDEN, 'forbidden'],
  [HttpStatus.NOT_FOUND, 'not_found'],
  [HttpStatus.CONFLICT, 'conflict'],
  [HttpStatus.UNPROCESSABLE_ENTITY, 'validation_failed'],
  [HttpStatus.TOO_MANY_REQUESTS, 'rate_limited'],
  [HttpStatus.SERVICE_UNAVAILABLE, 'service_unavailable']
]);

function codeFor(status: number): ApiErrorCode {
  return (
    CODE_BY_STATUS.get(status) ?? (status < 500 ? 'bad_request' : 'internal')
  );
}

/**
 * Extracts the human-facing message from an `HttpException` payload, which is
 * not one shape: Nest's own exceptions carry an object, the Fastify adapter
 * wraps transport-level failures around a bare string, and `ValidationPipe`
 * puts an array there.
 */
function messageFrom(payload: string | object): string {
  if (typeof payload === 'string') return payload;

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('; ');

  return 'Request failed.';
}

/**
 * The status a Fastify plugin's own error carries, when it blames the client.
 * `@fastify/error` instances are plain errors with a `statusCode`, not
 * `HttpException`s, so they would otherwise be logged as server defects. Only
 * 4xx is taken at its word; a plugin's 5xx is a defect like any other.
 */
function clientErrorStatus(exception: unknown): number | null {
  // A thrown value need not be an object — `throw null` reaches here too.
  if (typeof exception !== 'object' || exception === null) return null;

  const status = (exception as { statusCode?: unknown }).statusCode;
  if (typeof status !== 'number' || !Number.isInteger(status)) return null;

  return status >= 400 && status < 500 ? status : null;
}

/**
 * Renders every failure as the contract's single error body, so clients need
 * one failure path. It catches unconditionally on purpose: Nest's own defaults
 * are three different shapes and none carries a `code`, and everything reaches
 * here — the 404 for an unmatched route and the transport-level failures
 * Fastify raises before a handler runs included.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const body = this.toBody(exception);

    void reply.status(this.statusFor(exception)).send(body);
  }

  private statusFor(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    return clientErrorStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }

  // The contract reads `code` as any string so an old client survives a code it
  // predates; the writing side stays pinned to the enum.
  private toBody(exception: unknown): ApiError & { code: ApiErrorCode } {
    if (exception instanceof ApiException) {
      return {
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {})
      };
    }

    if (exception instanceof HttpException) {
      return {
        code: codeFor(exception.getStatus()),
        message: messageFrom(exception.getResponse())
      };
    }

    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== null) {
      return {
        code: codeFor(clientStatus),
        // `message` is required on the wire, and an object carrying a bare
        // `statusCode` would drop the key.
        message: (exception as Error).message || 'Request failed.'
      };
    }

    // A defect, not a client mistake: log the stack, answer with a fixed
    // message so nothing internal leaks.
    this.logger.error('Unhandled exception', exception);

    return { code: 'internal', message: 'Internal server error.' };
  }
}
