/**
 * PostgreSQL's `unique_violation`, wherever it ended up in the chain: Drizzle
 * wraps a driver error in its own and keeps the original as `cause`, so the code
 * is one level down from what the query threw.
 *
 * Every uniqueness rule here is also checked by a read first, because a read can
 * answer with a message worth showing. This is the other half of that: two
 * requests that pass the read together — a double-clicked form, two tabs — and
 * the constraint is what stops the second. Catching it is the difference between
 * a 409 the client can act on and a 500.
 */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error; current; current = (current as Error).cause) {
    if ((current as { code?: unknown }).code === '23505') return true;
  }
  return false;
}
