import type { LoggerService } from '@nestjs/common';
import type { FastifyBaseLogger } from 'fastify';

type PinoLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/** How a stack trace reads, which is how Nest tells one from a context. */
const STACK = /^.*\n\s+at .+/;

/**
 * Nest's `Logger` written through Fastify's pino, so the server writes one
 * JSON shape. Arguments are read as Nest's console logger reads them (a
 * trailing context, a stack string); a thrown value becomes `err`, and a plain
 * object as the message is the line's fields, its `msg` the message.
 */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly pino: FastifyBaseLogger) {}

  log(message: unknown, ...params: unknown[]): void {
    this.write('info', message, params);
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params);
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params);
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params);
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('trace', message, params);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, params);
  }

  private write(level: PinoLevel, message: unknown, params: unknown[]): void {
    const { fields, msg } = lineOf(message, params);
    this.pino[level](fields, msg);
  }
}

/** One Nest call's arguments as pino's merge object and message. */
export function lineOf(
  message: unknown,
  params: unknown[]
): { fields: Record<string, unknown>; msg: string } {
  const rest = [...params];
  const fields: Record<string, unknown> = {};

  const last = rest.at(-1);
  if (typeof last === 'string' && !STACK.test(last)) {
    fields['context'] = last;
    rest.pop();
  }

  let msg: string;
  if (isThrown(message)) {
    fields['err'] = message;
    msg = message.message;
  } else if (isPlainObject(message)) {
    const { msg: text, ...own } = message;
    Object.assign(fields, own);
    msg = typeof text === 'string' ? text : '';
  } else {
    msg = String(message);
  }

  const extra: unknown[] = [];
  for (const param of rest) {
    if (isThrown(param)) {
      fields['err'] = param;
    } else if (typeof param === 'string' && STACK.test(param)) {
      fields['err'] = { message: msg, stack: param };
    } else if (isPlainObject(param)) {
      Object.assign(fields, param);
    } else if (param !== undefined) {
      extra.push(param);
    }
  }
  if (extra.length > 0) fields['params'] = extra;

  return { fields, msg };
}

function isThrown(value: unknown): value is Error {
  return value instanceof Error;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
