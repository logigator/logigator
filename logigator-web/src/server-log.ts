import type { ErrorRequestHandler, Request } from 'express';

/**
 * The server's failure log: one JSON line per failure on stdout, in the shape
 * the API's logger (pino, through Fastify) writes — the same numeric `level`,
 * `time`, `reqId`, `req`, `res`, `err` and `msg` — so one query over the
 * stack's logs finds the failures of both. Nothing else is written here; a
 * request that succeeds leaves no line.
 */

/** pino's numeric `error` level. */
const ERROR = 50;

export type LogWriter = (line: string) => void;

const toStdout: LogWriter = (line) => {
  process.stdout.write(line);
};

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

function writeLine(
  write: LogWriter,
  level: number,
  fields: Record<string, unknown>,
  msg: string
): void {
  write(
    `${JSON.stringify({
      level,
      time: Date.now(),
      pid: process.pid,
      // What `os.hostname()` answers in a container, without a `node:` import
      // the unit-test bundle cannot resolve.
      hostname: process.env['HOSTNAME'],
      ...fields,
      msg
    })}\n`
  );
}

/**
 * Cloudflare's `Cf-Ray` for the request when the edge sent one, as the API
 * takes it, so a line names the request Cloudflare's own logs name; a random
 * UUID otherwise.
 */
function requestId(req: Request): string {
  const ray = req.headers['cf-ray'];
  return typeof ray === 'string' && ray !== '' ? ray : crypto.randomUUID();
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
 * (a path that does not decode) keeps its 4xx and stays quiet, as the API's do.
 * Everything else is a failure of this server: one `request failed` line, and
 * a plain `500` that says nothing about why — a render's error can carry
 * anything, the API's answers included.
 *
 * A response already under way cannot change its status, so it is cut off
 * instead, which a browser reports as the failure it is.
 */
export function createErrorHandler(
  write: LogWriter = toStdout
): ErrorRequestHandler {
  // Express tells an error handler from a middleware by its four parameters.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error: unknown, req, res, _next) => {
    const clientStatus = clientErrorStatus(error);
    if (clientStatus !== null && !res.headersSent) {
      res.sendStatus(clientStatus);
      return;
    }

    writeLine(
      write,
      ERROR,
      {
        reqId: requestId(req),
        req: { method: req.method, url: req.originalUrl },
        res: { statusCode: 500 },
        err: serializeError(error)
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
 * A failure no request owns, written as a line of the same log. `@angular/ssr`
 * registers handlers of its own for both events that print to the console,
 * which would write every one a second time, unstructured; these replace them.
 * Like Angular's, they keep the process serving: a render that throws from a
 * timer would otherwise take every request in flight down with it.
 */
export function logProcessFailures(write: LogWriter = toStdout): void {
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  process.on('unhandledRejection', (reason) => {
    writeLine(
      write,
      ERROR,
      { err: serializeError(reason) },
      'unhandled rejection'
    );
  });
  process.on('uncaughtException', (error) => {
    writeLine(
      write,
      ERROR,
      { err: serializeError(error) },
      'uncaught exception'
    );
  });
}
