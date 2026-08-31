import { describe, expect, it } from 'vitest';
import {
  apiErrorCodeSchema,
  apiErrorSchema,
  isKnownApiErrorCode
} from './api-error.contract';

describe('apiErrorSchema', () => {
  // Why `code` reads as a string: a client has to survive a code the API added
  // after it shipped, on the very response explaining what went wrong.
  it('accepts a code this copy does not know', () => {
    const parsed = apiErrorSchema.parse({
      code: 'quota_exceeded',
      message: 'Too many projects.'
    });

    expect(parsed.code).toBe('quota_exceeded');
    expect(isKnownApiErrorCode(parsed.code)).toBe(false);
  });

  it('reports a declared code as known', () => {
    for (const code of apiErrorCodeSchema.options) {
      expect(isKnownApiErrorCode(code)).toBe(true);
    }
  });

  it('rejects a body with no message to fall back to', () => {
    expect(apiErrorSchema.safeParse({ code: 'internal' }).success).toBe(false);
  });

  it('keeps fields a newer API added', () => {
    const parsed = apiErrorSchema.parse({
      code: 'conflict',
      message: 'Name is taken.',
      retryAfter: 30
    });

    expect(parsed).toHaveProperty('retryAfter', 30);
  });
});
