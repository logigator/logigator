import { describe, expect, it } from 'vitest';
import type { Request, Response } from 'express';
import { createErrorHandler } from './server-errors';

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
  const lines: string[] = [];
  const { res, answer } = response(headersSent);
  createErrorHandler((line) => lines.push(line))(error, req, res, () => {
    throw new Error('the last handler never passes an error on');
  });
  return {
    answer,
    logged: lines.map((line) => JSON.parse(line) as Record<string, unknown>)
  };
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
