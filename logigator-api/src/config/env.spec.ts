import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('falls back to defaults for an empty environment', () => {
    expect(loadEnv({})).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      LOG_LEVEL: 'info'
    });
  });

  it('treats a blank value as unset', () => {
    expect(loadEnv({ PORT: '', LOG_LEVEL: '  ' })).toMatchObject({
      PORT: 3000,
      LOG_LEVEL: 'info'
    });
  });

  it('parses the port as a number', () => {
    expect(loadEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a port outside the valid range', () => {
    expect(() => loadEnv({ PORT: '70000' })).toThrowError(/PORT/);
  });

  it('rejects an unknown NODE_ENV instead of passing it through', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrowError(/NODE_ENV/);
  });

  it('reports every problem at once', () => {
    let message = '';
    try {
      loadEnv({ PORT: 'http', LOG_LEVEL: 'chatty' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toMatch(/PORT/);
    expect(message).toMatch(/LOG_LEVEL/);
  });
});
