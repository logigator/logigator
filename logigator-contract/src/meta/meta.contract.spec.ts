import { describe, expect, it } from 'vitest';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import { metaResponseSchema } from './meta.contract';

const response = {
  formatVersion: CURRENT_FILE_VERSION,
  authProviders: ['local' as const]
};

describe('metaResponseSchema', () => {
  it('accepts the format version the shared core currently writes', () => {
    const parsed = metaResponseSchema.parse(response);

    expect(parsed.formatVersion).toBe(CURRENT_FILE_VERSION);
  });

  it('keeps fields a newer API added', () => {
    const parsed = metaResponseSchema.parse({
      ...response,
      featureFlags: ['collab']
    });

    expect(parsed['featureFlags']).toEqual(['collab']);
  });

  it('rejects a non-integer format version', () => {
    expect(
      metaResponseSchema.safeParse({ ...response, formatVersion: 1.5 }).success
    ).toBe(false);
  });

  it('rejects a sign-in method this copy of the contract does not know', () => {
    // Unlike the error codes, this list is closed on purpose: a client cannot do
    // anything useful with a provider it has no button for, and silently
    // accepting one would hide the mismatch.
    expect(
      metaResponseSchema.safeParse({ ...response, authProviders: ['twitter'] })
        .success
    ).toBe(false);
  });
});
