import { sql, type Column, type SQL, type Table } from 'drizzle-orm';

/**
 * The two derived fields every public listing carries, as correlated
 * subqueries.
 *
 * A subquery per row rather than a `LEFT JOIN … GROUP BY`, which is what the
 * legacy version did: grouping means naming every selected column in the
 * `GROUP BY`, so the query has to be rewritten whenever a column is added, and
 * the star count and the "did I star it" flag would need two different groupings
 * anyway. At a page of rows this costs an index lookup each.
 *
 * The count is deliberately not a column on the document. A counter is one more
 * thing that can drift from the rows it summarizes, and these listings read it
 * in aggregate regardless.
 */

/** How many accounts have starred this row. */
export function starCount(
  stars: Table,
  starredCircuit: Column,
  circuitId: Column
): SQL<number> {
  return sql<number>`(
    SELECT count(*) FROM ${stars} WHERE ${starredCircuit} = ${circuitId}
  )`;
}

/**
 * Whether the caller has starred this row — `false` for a visitor with no
 * session, rather than absent: a browse page draws the same control either way,
 * and "not starred" is exactly what an anonymous visitor's star state is.
 */
export function starredByCaller(
  stars: Table,
  starredCircuit: Column,
  circuitId: Column,
  starredBy: Column,
  userId: string | null
): SQL<boolean> {
  if (!userId) return sql<boolean>`false`;

  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${stars}
     WHERE ${starredCircuit} = ${circuitId} AND ${starredBy} = ${userId}
  )`;
}
