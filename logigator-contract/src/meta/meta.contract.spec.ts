import { describe, expect, it } from 'vitest';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import { metaResponseSchema } from './meta.contract';

describe('metaResponseSchema', () => {
  it('accepts the format version the shared core currently writes', () => {
    const parsed = metaResponseSchema.parse({
      formatVersion: CURRENT_FILE_VERSION
    });

    expect(parsed.formatVersion).toBe(CURRENT_FILE_VERSION);
  });

  it('keeps fields a newer API added', () => {
    const parsed = metaResponseSchema.parse({
      formatVersion: CURRENT_FILE_VERSION,
      featureFlags: ['collab']
    });

    expect(parsed['featureFlags']).toEqual(['collab']);
  });

  it('rejects a non-integer format version', () => {
    expect(metaResponseSchema.safeParse({ formatVersion: 1.5 }).success).toBe(
      false
    );
  });
});
