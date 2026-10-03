/**
 * PostgreSQL's `unique_violation`, wherever it ended up in the chain: Drizzle
 * wraps a driver error in its own and keeps the original as `cause`.
 *
 * Every uniqueness rule is checked by a read first, since a read can answer
 * with a message worth showing. This is the other half: two requests that pass
 * the read together, where catching the constraint is the difference between a
 * 409 the client can act on and a 500.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current; current = (current as Error).cause) {
    if ((current as { code?: unknown }).code === '23505') return true;
  }
  return false;
}
