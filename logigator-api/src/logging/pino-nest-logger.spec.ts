import { describe, expect, it } from 'vitest';
import { lineOf } from './pino-nest-logger';

const stack = 'Error: boom\n    at run (/app/main.js:1:1)';

describe('lineOf', () => {
  it("reads a Logger's trailing context as a field, not as text", () => {
    expect(lineOf('Connected', ['Database'])).toEqual({
      fields: { context: 'Database' },
      msg: 'Connected'
    });
  });

  it('keeps a thrown value as err beside the message and context', () => {
    const error = new Error('refused');
    const line = lineOf('Client error', [error, 'Redis']);
    expect(line.msg).toBe('Client error');
    expect(line.fields['err']).toBe(error);
    expect(line.fields['context']).toBe('Redis');
  });

  it('tells a stack from a context, as Nest does', () => {
    expect(lineOf('Failed', [stack]).fields).toEqual({
      err: { message: 'Failed', stack }
    });
    expect(lineOf('Failed', [stack, 'Bootstrap']).fields).toEqual({
      err: { message: 'Failed', stack },
      context: 'Bootstrap'
    });
  });

  it('writes a thrown message as err with its own message', () => {
    const error = new Error('no database');
    expect(lineOf(error, ['Bootstrap'])).toEqual({
      fields: { err: error, context: 'Bootstrap' },
      msg: 'no database'
    });
  });

  it("spreads an object message into fields, its msg the line's message", () => {
    expect(
      lineOf({ event: 'sweep', removed: 3, msg: 'Swept' }, ['Sweep'])
    ).toEqual({
      fields: { event: 'sweep', removed: 3, context: 'Sweep' },
      msg: 'Swept'
    });
  });
});
