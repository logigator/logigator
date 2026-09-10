import { sql, type Column, type SQL, type Table } from 'drizzle-orm';

/**
 * The two derived fields every public listing carries, as correlated
 * subqueries. Not a `LEFT JOIN … GROUP BY`: grouping means naming every
 * selected column, and the two fields would need different groupings anyway. At
 * a page of rows each costs one index lookup.
 *
 * The count is not a column on the document — a counter is one more thing that
 * can drift from the rows it summarizes.
 */

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
 * Whether the caller has starred this row. `false` for a visitor with no
 * session rather than absent: a browse page draws the same control either way.
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

/**
 * How many stars a row collected inside the trending window. A window rather
 * than a decay score: weighting every star by its age reads every star row
 * instead of an indexed range, and it cannot be explained to a visitor asking
 * why one circuit sits above another.
 *
 * The interval is built in SQL from a day count rather than a timestamp
 * computed here, so a long-lived process does not rank against the moment it
 * booted.
 */
export function starCountSince(
  stars: Table,
  starredCircuit: Column,
  circuitId: Column,
  starredAt: Column,
  days: number
): SQL<number> {
  return sql<number>`(
    SELECT count(*) FROM ${stars}
     WHERE ${starredCircuit} = ${circuitId}
       AND ${starredAt} >= now() - make_interval(days => ${days})
  )`;
}
