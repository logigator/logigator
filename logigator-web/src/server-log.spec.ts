import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import {
  configuredLogLevel,
  createErrorHandler,
  createRequestLogger,
  createServerLog,
  logRenderError,
  requestId,
  type LogLevel
} from './server-log';

/** A log at `threshold` and the lines it wrote, parsed. */
function capture(threshold: LogLevel = 'info') {
  const lines: string[] = [];
  return {
    log: createServerLog((line) => lines.push(line), threshold),
    logged: () =>
      lines.map((line) => JSON.parse(line) as Record<string, unknown>)
  };
}

/** The parts of a request the handler reads. */
function request(headers: Record<string, string> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/en/community/projects?page=2',
    headers
  } as unknown as Request;
}

/**
 * A response that records what the handler answered. It has no `send`: the
 * only body it can write is `sendStatus`'s, the status's own text.
 */
function response(headersSent = false) {
  const answer = {
    status: 0,
    headers: {} as Record<string, string>,
    destroyed: false
  };
  const res = {
    headersSent,
    set(name: string, value: string) {
      answer.headers[name] = value;
      return res;
    },
    sendStatus(code: number) {
      answer.status = code;
      return res;
    },
    destroy() {
      answer.destroyed = true;
      return res;
    }
  };
  return { res: res as unknown as Response, answer };
}

function handle(error: unknown, req = request(), headersSent = false) {
  const { log, logged } = capture();
  const { res, answer } = response(headersSent);
  createErrorHandler(log)(error, req, res, () => {
    throw new Error('the last handler never passes an error on');
  });
  return { answer, logged: logged() };
}

describe('the server error handler', () => {
  it('answers a plain 500 that says nothing about the failure', () => {
    const { answer } = handle(new Error('connect ECONNREFUSED api:3000'));

    expect(answer.status).toBe(500);
    expect(answer.headers['Cache-Control']).toBe('no-store');
  });

  it('logs the failure as one line in the API logger’s shape', () => {
    const { logged } = handle(
      new TypeError('a render failed'),
      request({ 'cf-ray': '8f2a1c-FRA' })
    );

    expect(logged).toEqual([
      expect.objectContaining({
        level: 50,
        time: expect.any(Number),
        reqId: '8f2a1c-FRA',
        req: { method: 'GET', url: '/en/community/projects?page=2' },
        res: { statusCode: 500 },
        err: expect.objectContaining({
          type: 'TypeError',
          message: 'a render failed',
          stack: expect.stringContaining('TypeError: a render failed')
        }),
        msg: 'request failed'
      })
    ]);
  });

  it('names a request the edge did not with an id of its own', () => {
    const first = handle(new Error('one')).logged[0];
    const second = handle(new Error('two')).logged[0];

    expect(first['reqId']).toEqual(expect.any(String));
    expect(first['reqId']).not.toBe(second['reqId']);
  });

  it('names one request by one id, whichever line asks first', () => {
    // The render takes the id before anything fails; the failure's line has
    // to carry the same one, or the two cannot be put together.
    const req = request();
    const id = requestId(req);

    expect(handle(new Error('late'), req).logged[0]?.['reqId']).toBe(id);
  });

  it('logs a thrown non-error too', () => {
    const { answer, logged } = handle(null);

    expect(answer.status).toBe(500);
    expect(logged).toHaveLength(1);
  });

  it('keeps a client’s 4xx and stays quiet about it', () => {
    const { answer, logged } = handle(
      Object.assign(new URIError('URI malformed'), { status: 400 })
    );

    expect(answer.status).toBe(400);
    expect(logged).toEqual([]);
  });

  it('treats a 5xx an error names for itself as its own failure', () => {
    const { answer, logged } = handle(
      Object.assign(new Error('upstream'), { status: 502 })
    );

    expect(answer.status).toBe(500);
    expect(logged).toHaveLength(1);
  });

  it('cuts off a response already under way rather than answering twice', () => {
    const { answer, logged } = handle(
      new Error('stream broke'),
      request(),
      true
    );

    expect(answer.destroyed).toBe(true);
    expect(answer.status).toBe(0);
    expect(logged).toHaveLength(1);
  });
});

describe('a render error', () => {
  it('is logged in the same shape, under the request it happened in', () => {
    const { log, logged } = capture();
    logRenderError(
      new TypeError('a template failed'),
      { reqId: '8f2a1c-FRA', method: 'GET', url: '/en/docs?q=wire' },
      log
    );

    expect(logged()).toEqual([
      expect.objectContaining({
        level: 50,
        reqId: '8f2a1c-FRA',
        req: { method: 'GET', url: '/en/docs?q=wire' },
        err: expect.objectContaining({
          type: 'TypeError',
          message: 'a template failed'
        }),
        msg: 'render error'
      })
    ]);
  });
});

describe('the request line', () => {
  /** Runs one request through the logger and finishes it with `status`. */
  function complete(
    threshold: LogLevel,
    status: number,
    req = request({ 'cf-ray': '8f2a1c-FRA' })
  ) {
    const { log, logged } = capture(threshold);
    const finished: (() => void)[] = [];
    const res = {
      statusCode: status,
      on(event: string, listener: () => void) {
        if (event === 'finish') finished.push(listener);
        return res;
      }
    };
    let passedOn = false;
    createRequestLogger(log)(req, res as unknown as Response, () => {
      passedOn = true;
    });
    for (const listener of finished) listener();
    return { passedOn, logged: logged() };
  }

  it('is written once a response is sent, whatever its status', () => {
    const { passedOn, logged } = complete('info', 404);

    expect(passedOn).toBe(true);
    expect(logged).toEqual([
      expect.objectContaining({
        level: 30,
        reqId: '8f2a1c-FRA',
        req: { method: 'GET', url: '/en/community/projects?page=2' },
        res: { statusCode: 404 },
        responseTime: expect.any(Number),
        msg: 'request completed'
      })
    ]);
  });

  it('carries the id a later failure line of the same request carries', () => {
    const req = request();
    const { logged } = complete('info', 200, req);

    expect(logged[0]?.['reqId']).toBe(requestId(req));
  });

  it('is left out above info, while failures still are not', () => {
    expect(complete('warn', 200).logged).toEqual([]);

    const { log, logged } = capture('warn');
    logRenderError(new Error('broken'), null, log);
    expect(logged()).toHaveLength(1);
  });
});

describe('LOG_LEVEL', () => {
  it('defaults to info, as the API does', () => {
    expect(configuredLogLevel(undefined)).toBe('info');
    expect(configuredLogLevel('')).toBe('info');
  });

  it('refuses a level the API would refuse', () => {
    expect(configuredLogLevel('debug')).toBe('debug');
    expect(() => configuredLogLevel('verbose')).toThrow(/LOG_LEVEL/);
    expect(() => configuredLogLevel('toString')).toThrow(/LOG_LEVEL/);
  });

  it('writes nothing at all when silent', () => {
    const { log, logged } = capture('silent');
    logRenderError(new Error('broken'), null, log);

    expect(logged()).toEqual([]);
  });
});
