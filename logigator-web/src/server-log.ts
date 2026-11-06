import type { ErrorRequestHandler, Request, RequestHandler } from 'express';

/**
 * The server's log: JSON lines on stdout in the shape the API's logger (pino,
 * through Fastify) writes — the same `level` by name, `time`, `reqId`, `req`,
 * `res`, `err` and `msg`, and `event: 'error'` on a failure's line — so one
 * query over the stack's logs finds the lines of both. `LOG_LEVEL` takes the
 * API's values and default too.
 */

/** pino's numeric levels, which order the names; `silent` writes nothing. */
const LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: Infinity
} as const;

export type LogLevel = keyof typeof LEVELS;

/** Writes one line at a level, or nothing below the configured one. */
export type ServerLog = (
  level: Exclude<LogLevel, 'silent'>,
  fields: Record<string, unknown>,
  msg: string
) => void;

/**
 * The level `LOG_LEVEL` names, `info` where it is unset. Any other value stops
 * the server, as the API's environment check does.
 */
export function configuredLogLevel(
  value: string | undefined = process.env['LOG_LEVEL']
): LogLevel {
  if (value === undefined || value === '') return 'info';
  if (Object.hasOwn(LEVELS, value)) return value as LogLevel;
  throw new Error(
    `LOG_LEVEL must be one of ${Object.keys(LEVELS).join(', ')}; got "${value}".`
  );
}

/** A log that writes its lines to `sink`, from `threshold` up. */
export function createServerLog(
  sink: (line: string) => void,
  threshold: LogLevel
): ServerLog {
  return (level, fields, msg) => {
    if (LEVELS[level] < LEVELS[threshold]) return;
    sink(
      `${JSON.stringify({
        level,
        time: Date.now(),
        ...fields,
        msg
      })}\n`
    );
  };
}

const stdoutLog = createServerLog(
  (line) => process.stdout.write(line),
  configuredLogLevel()
);

interface SerializedError {
  type: string;
  message: string;
  stack?: string;
}

/** A thrown value as pino's `err` serializer would write it. */
function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return { type: error.name, message: error.message, stack: error.stack };
  }
  return { type: typeof error, message: String(error) };
}

/** A failure this log writes, as a counter names it. */
export type ServerFailure =
  'render_error' | 'unhandled_rejection' | 'uncaught_exception';

type FailureListener = (failure: ServerFailure) => void;

/**
 * The listeners, on the global object: `server.ts` and the render are bundled
 * apart, each with a copy of this module.
 */
const failureListeners = ((globalThis as Record<symbol, unknown>)[
  Symbol.for('logigator.serverFailureListeners')
] ??= new Set<FailureListener>()) as Set<FailureListener>;

/**
 * Calls `listener` with every failure logged from now on, whatever the level
 * lets through. Returns its removal.
 */
export function onServerFailure(listener: FailureListener): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

function reportFailure(failure: ServerFailure): void {
  for (const listener of failureListeners) listener(failure);
}

const requestIds = new WeakMap<Request, string>();

/** 72 random bits in base64url, as the API generates its own. */
function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_');
}

/**
 * Cloudflare's `Cf-Ray` for the request when the edge sent one, as the API
 * takes it, so a line names the request Cloudflare's own logs name; 12 random
 * characters otherwise, the same every time it is asked for the same request.
 */
export function requestId(req: Request): string {
  let id = requestIds.get(req);
  if (id === undefined) {
    const ray = req.headers['cf-ray'];
    id = typeof ray === 'string' && ray !== '' ? ray : randomId();
    requestIds.set(req, id);
  }
  return id;
}

/**
 * The first handler of the chain: one `request completed` line per response,
 * at `info`, once it has been sent. Fastify writes an `incoming request` line
 * as well; here a request that never completes has its `request failed` line
 * instead.
 */
export function createRequestLogger(
  log: ServerLog = stdoutLog
): RequestHandler {
  return (req, res, next) => {
    const start = performance.now();
    const reqId = requestId(req);
    res.on('finish', () => {
      log(
        'info',
        {
          reqId,
          req: { method: req.method, url: req.originalUrl },
          res: { statusCode: res.statusCode },
          responseTime: Math.round((performance.now() - start) * 100) / 100
        },
        'request completed'
      );
    });
    next();
  };
}

/** The status an error names for itself, when it blames the client. */
function clientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const { status, statusCode } = error as {
    status?: unknown;
    statusCode?: unknown;
  };
  const named = status ?? statusCode;
  return typeof named === 'number' && named >= 400 && named < 500
    ? named
    : null;
}

/**
 * The last handler of the chain. A client's mistake that Express raised itself
 * (a path that does not decode) keeps its 4xx and is no failure, as the API's
 * are not. Everything else is a failure of this server: one `request failed`
 * line, and a plain `500` that says nothing about why — a render's error can
 * carry anything, the API's answers included.
 *
 * A response already under way cannot change its status, so it is cut off
 * instead, which a browser reports as the failure it is.
 */
export function createErrorHandler(
  log: ServerLog = stdoutLog
): ErrorRequestHandler {
  // Express tells an error handler from a middleware by its four parameters.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: unknown, req, res, _next) => {
    const clientStatus = clientErrorStatus(error);
    if (clientStatus !== null && !res.headersSent) {
      res.sendStatus(clientStatus);
      return;
    }

    log(
      'error',
      {
        reqId: requestId(req),
        req: { method: req.method, url: req.originalUrl },
        res: { statusCode: 500 },
        err: serializeError(error),
        event: 'error'
      },
      'request failed'
    );

    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.set('Cache-Control', 'no-store').sendStatus(500);
  };
}

/**
 * An error Angular's `ErrorHandler` caught during a render, which the render
 * survived, so the request still answers as if nothing failed. Logged as the
 * request's own line would be, with whatever of the request the render knows.
 */
export function logRenderError(
  error: unknown,
  request: { reqId: string | null; method: string; url: string } | null,
  log: ServerLog = stdoutLog
): void {
  reportFailure('render_error');
  log(
    'error',
    {
      ...(request?.reqId ? { reqId: request.reqId } : {}),
      ...(request ? { req: { method: request.method, url: request.url } } : {}),
      err: serializeError(error),
      event: 'error'
    },
    'render error'
  );
}

/**
 * A failure no request owns, written as a line of the same log. `@angular/ssr`
 * registers handlers of its own for both events that print to the console,
 * which would write every one a second time, unstructured; these replace them.
 * Like Angular's, they keep the process serving: a render that throws from a
 * timer would otherwise take every request in flight down with it.
 */
export function logProcessFailures(log: ServerLog = stdoutLog): void {
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  process.on('unhandledRejection', (reason) => {
    reportFailure('unhandled_rejection');
    log(
      'error',
      { err: serializeError(reason), event: 'error' },
      'unhandled rejection'
    );
  });
  process.on('uncaughtException', (error) => {
    reportFailure('uncaught_exception');
    log(
      'error',
      { err: serializeError(error), event: 'error' },
      'uncaught exception'
    );
  });
}
