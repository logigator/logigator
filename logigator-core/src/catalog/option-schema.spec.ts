import { describe, expect, it } from 'vitest';
import { canonicalNameMap } from './option-schema';

describe('canonicalNameMap', () => {
  const KEYS = ['up', 'down', 'a', 'b'];

  it('trims every name and drops the ones left empty', () => {
    expect(
      canonicalNameMap(KEYS, { up: '  Jump ', down: '', a: '   ', b: 'Fire' })
    ).toEqual({ up: 'Jump', b: 'Fire' });
  });

  it('orders keys as the schema lists them, whatever order they came in', () => {
    const canonical = canonicalNameMap(KEYS, { b: 'B1', up: 'U1', a: 'A1' });
    expect(Object.keys(canonical)).toEqual(['up', 'a', 'b']);
    // Equal name sets serialize identically.
    expect(JSON.stringify(canonical)).toBe(
      JSON.stringify(canonicalNameMap(KEYS, { a: 'A1', up: 'U1', b: 'B1 ' }))
    );
  });

  it('drops keys outside the list and values that are not strings', () => {
    expect(canonicalNameMap(KEYS, { up: 'Jump', left: 'X', a: 4 })).toEqual({
      up: 'Jump'
    });
  });
});
