/**
 * Vitest-compatible replacement for jasmine.arrayWithExactContents.
 * Returns an asymmetric matcher that succeeds when the actual array contains
 * exactly the expected items (any order, no extras), compared by identity.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function arrayWithExactContents<T>(expected: T[]): any {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (!Array.isArray(actual)) return false;
      if (actual.length !== expected.length) return false;
      const remaining = [...actual];
      for (const item of expected) {
        const idx = remaining.indexOf(item);
        if (idx === -1) return false;
        remaining.splice(idx, 1);
      }
      return remaining.length === 0;
    }
  };
}

/** Generator helper — yields each argument in order. */
export function* gen<T>(...items: T[]): Generator<T> {
  yield* items;
}
