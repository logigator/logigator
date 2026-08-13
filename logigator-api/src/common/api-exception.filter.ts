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
 * else is collapsed: a remaining 4xx becomes `bad_request` (a client can do no
 * more about a 415 than about a 400 — the status is still there for the rare
 * caller that cares), and everything at 5xx becomes `internal`.
 */
const CODE_BY_STATUS = new Map<number, ApiErrorCode>([
  [HttpStatus.BAD_REQUEST, 'bad_request'],
  [HttpStatus.UNAUTHORIZED, 'unauthorized'],
  [HttpStatus.FORBIDDEN, 'forbidden'],
  [HttpStatus.NOT_FOUND, 'not_found'],
  [HttpStatus.CONFLICT, 'conflict'],
  [HttpStatus.UNPROCESSABLE_ENTITY, 'validation_failed']
]);

function codeFor(status: number): ApiErrorCode {
  return (
    CODE_BY_STATUS.get(status) ?? (status < 500 ? 'bad_request' : 'internal')
  );
}

/**
 * Extracts the human-facing message from an `HttpException` payload.
 *
 * The payload is not one shape. Nest's own exceptions carry an object, but the
 * Fastify adapter wraps its transport-level failures — malformed JSON body,
 * payload over the body limit, unsupported media type — into an `HttpException`
 * whose payload is a bare string, and `ValidationPipe` puts an array there.
 * Reading `.message` off any of those but the first yields `undefined`.
 */
function messageFrom(payload: string | object): string {
  if (typeof payload === 'string') return payload;

  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) return message.join('; ');

  return 'Request failed.';
}

/**
 * Renders every failure as the contract's single error body, so clients need
 * one failure path.
 *
 * It catches unconditionally on purpose. Nest's default responses are three
 * different shapes — `{message, error, statusCode}` for its own exceptions,
 * `{statusCode, message}` for an unhandled error, and a bare JSON string for
 * the adapter-wrapped Fastify failures — and none of them carries a `code`.
 * Everything reaches here, including the 404 for an unmatched route and the
 * transport-level failures Fastify raises before a handler runs.
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
    return exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  // The contract reads `code` as any string so an old client survives a code it
  // predates. The server is the writing side, so it stays pinned to the enum —
  // a code that is not declared there never reaches the wire.
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

    // An error that reached here is a defect, not a client mistake: log it with
    // its stack, and answer with a fixed message so nothing internal leaks.
    this.logger.error('Unhandled exception', exception);

    return { code: 'internal', message: 'Internal server error.' };
  }
}
