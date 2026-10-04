import {
  count,
  eq,
  getColumnTable,
  getTableName,
  sql,
  type Column,
  type SQL,
  type Table
} from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { Queryable } from '../database/database.module';
import {
  componentStars,
  components,
  projectStars,
  projects
} from '../database/schema';

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

/**
 * The stars a member's published documents have collected — **received, not
 * given**, which is the only tally a profile shows: what somebody gave away is
 * on the document they gave it to.
 *
 * The one star query that spans both tables, because a member publishes
 * projects and components and a profile counts their work rather than one kind
 * of it. `starCount` counts one row's stars and is parameterised by the table
 * it counts in; here the two are summed, so it is written out as two counts
 * joined to the documents they belong to. It stays a correlated subquery in the
 * outer `users` select rather than a query of its own — the profile read holds
 * the row already, and this is one more column of the same answer.
 *
 * **`visibility = 'public'` is load-bearing, exactly as it is in every other
 * community predicate.** A private document's stars would otherwise fold into a
 * public number, which publishes a total that includes work nobody is allowed
 * to see — and an unpublished document's page is not one a reader could reach
 * to find out what the number was made of. The count therefore falls when a
 * document is unpublished, which is the same rule the listings follow.
 *
 * `count(*)` is `bigint`, so `pg` hands the sum over as a string; callers
 * convert, the way they do for `starCount`.
 */
export function receivedStarCount(circuitOwner: Column): SQL<number> {
  // The outer column is spelled out with its table, which `starCount` can leave
  // off: the only `id` in its subquery's scope is the outer one, while each half
  // of this one joins a document table that has an `id` of its own — and a bare
  // `"id"` binds to *that*, counting zero rather than failing loudly. Written as
  // identifiers rather than as a `Column` chunk, which the builder renders
  // unqualified in a select list.
  const owner = sql`${sql.identifier(getTableName(getColumnTable(circuitOwner)))}.${sql.identifier(circuitOwner.name)}`;

  return sql<number>`(
    SELECT count(*) FROM ${projectStars} project_star
      JOIN ${projects} project ON project.id = project_star.project_id
     WHERE project.user_id = ${owner}
       AND project.visibility = 'public'
  ) + (
    SELECT count(*) FROM ${componentStars} component_star
      JOIN ${components} component ON component.id = component_star.component_id
     WHERE component.user_id = ${owner}
       AND component.visibility = 'public'
  )`;
}

/**
 * The lifetime tally of one row whose id is already in hand — the one star
 * query that is not part of a select list.
 *
 * A star is set, a card is composed and a share link is read by three services
 * that each hold the row already, so there is no outer query to correlate
 * against and nothing to gain from `starCount`'s shape. It was written out
 * three times before this; it is one query, so it is one function.
 *
 * `PgTable` rather than `Table` because the query builder, unlike the `sql`
 * template the builders above use, needs a table it can name.
 */
export async function starTally(
  db: Queryable,
  stars: PgTable,
  starredCircuit: Column,
  circuitId: string
): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(stars)
    .where(eq(starredCircuit, circuitId));

  // `count()` maps its own result through `Number`, so the `bigint` `pg` hands
  // over arrives as a number rather than a string.
  return row?.value ?? 0;
}
