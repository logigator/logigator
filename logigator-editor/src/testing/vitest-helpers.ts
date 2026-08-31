/**
 * Asymmetric matcher succeeding when the actual array holds exactly the
 * expected items by identity — any order, no extras.
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
