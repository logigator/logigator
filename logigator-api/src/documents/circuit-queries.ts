import {
  and,
  count,
  desc,
  eq,
  ilike,
  ne,
  sql,
  type Column,
  type SQL
} from 'drizzle-orm';
import type { Page, PageQuery } from '@logigator/contract';
import type { Queryable } from '../database/database.module';
import {
  components,
  projects,
  users,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';

/**
 * Either stored-circuit table. Projects and components are the same thing — a
 * document plus derived metadata — in two tables, so ownership, forks and
 * dependency edges are real foreign keys and a component can carry the extra
 * columns a placed instance renders from.
 *
 * Only the shared half is queried here; a component's port columns stay in its
 * own service, since sharing those would mean a union of insert shapes.
 *
 * Each query is **overloaded per table** rather than generic: Drizzle's builder
 * types are conditional on the table, and a conditional type cannot resolve
 * against an unresolved type parameter, so `<T extends CircuitTable>` fails at
 * the first `.from(table)`. Two signatures over a union implementation keeps
 * the call sites exactly typed with no assertions.
 */
export type CircuitTable = typeof projects | typeof components;

/** One row of either table. */
export type CircuitRow = ProjectRow | ComponentRow;

/**
 * The caller's own row, or `null`. Ownership is in the predicate, not a check
 * afterwards: no path holds a row without knowing whose it is, and somebody
 * else's document is indistinguishable from one that does not exist.
 */
export function findOwned(
  db: Queryable,
  table: typeof projects,
  userId: string,
  id: string
): Promise<ProjectRow | null>;
export function findOwned(
  db: Queryable,
  table: typeof components,
  userId: string,
  id: string
): Promise<ComponentRow | null>;
export async function findOwned(
  db: Queryable,
  table: CircuitTable,
  userId: string,
  id: string
): Promise<CircuitRow | null> {
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * A row by its share token, whoever owns it. The token is the document's
 * *address* rather than a grant: what it resolves to is decided by the
 * predicate the caller adds, which is what {@link linkResolvesFor} below is.
 */
export function findByLink(
  db: Queryable,
  table: typeof projects,
  link: string
): Promise<ProjectRow | null>;
export function findByLink(
  db: Queryable,
  table: typeof components,
  link: string
): Promise<ComponentRow | null>;
export async function findByLink(
  db: Queryable,
  table: CircuitTable,
  link: string
): Promise<CircuitRow | null> {
  const [row] = await db
    .select()
    .from(table)
    .where(eq(table.link, link))
    .limit(1);
  return row ?? null;
}

/**
 * The predicate every read addressed by a link carries: everything but a
 * private document, which resolves for its owner alone. A visitor (`null`)
 * holds no account to match, so that half of the rule cannot be satisfied.
 *
 * Stated once because the share read, its composed card, its clone and the
 * community page are four routes to one document, addressed by the same token
 * — they have to answer for the same documents, or one of them serves a page
 * another calls missing. The other predicate, `visibility = 'public'`, belongs
 * to the listings, which are a different question about the same rows.
 */
export function linkResolvesFor(
  table: CircuitTable,
  callerId: string | null
): SQL {
  const openToEverybody = ne(table.visibility, 'private');
  if (callerId === null) return openToEverybody;

  // Written out as SQL rather than through drizzle's `or()`, which is typed
  // `SQL | undefined` for its empty-argument case: this predicate is the access
  // rule of every link-addressed read, and it is composed again inside each
  // caller's `and()`, where an `undefined` would drop out silently and leave
  // the link comparison to stand on its own. The parentheses are the rule.
  return sql`(${openToEverybody} or ${eq(table.userId, callerId)})`;
}

/** A row by its share token, if the link resolves for this caller. */
export function findByResolvingLink(
  db: Queryable,
  table: typeof projects,
  link: string,
  callerId: string | null
): Promise<ProjectRow | null>;
export function findByResolvingLink(
  db: Queryable,
  table: typeof components,
  link: string,
  callerId: string | null
): Promise<ComponentRow | null>;
export async function findByResolvingLink(
  db: Queryable,
  table: CircuitTable,
  link: string,
  callerId: string | null
): Promise<CircuitRow | null> {
  const [row] = await db
    .select()
    .from(table)
    .where(and(eq(table.link, link), linkResolvesFor(table, callerId)))
    .limit(1);
  return row ?? null;
}

/**
 * One page of rows matching `where`, with the total the predicate matched. Two
 * statements rather than a `count(*) OVER ()` carried on every row of the page.
 *
 * The default order closes on `id`, as every community ranking does: paging is
 * `OFFSET`-based, so a tie the database breaks differently between two requests
 * drops or repeats a row — and two documents saved in the same operation share
 * an edit time exactly.
 */
export function pageOf(
  db: Queryable,
  table: typeof projects,
  where: SQL | undefined,
  query: PageQuery,
  order?: SQL[]
): Promise<Page<ProjectRow>>;
export function pageOf(
  db: Queryable,
  table: typeof components,
  where: SQL | undefined,
  query: PageQuery,
  order?: SQL[]
): Promise<Page<ComponentRow>>;
export async function pageOf(
  db: Queryable,
  table: CircuitTable,
  where: SQL | undefined,
  query: PageQuery,
  order: SQL[] = [desc(table.lastEditedAt), desc(table.id)]
): Promise<Page<CircuitRow>> {
  const [entries, [totals]] = await Promise.all([
    db
      .select()
      .from(table)
      .where(where)
      .orderBy(...order)
      .limit(query.size)
      .offset(query.page * query.size),
    db.select({ value: count() }).from(table).where(where)
  ]);

  return {
    entries,
    page: query.page,
    pageSize: query.size,
    total: totals?.value ?? 0
  };
}

/**
 * A name search, or `undefined` when there is nothing to search for. `%` and
 * `_` are escaped — left alone they let a search box ask for every row.
 */
export function nameMatches(
  name: Column,
  search: string | undefined
): SQL | undefined {
  if (!search) return undefined;
  const escaped = search.replaceAll(/[\\%_]/g, (char) => `\\${char}`);
  return ilike(name, `%${escaped}%`);
}

/** One ancestor of a fork, with the author the server derived rather than read. */
export interface AncestorRow {
  id: string;
  name: string;
  link: string;
  authorName: string;
}

/**
 * A document's fork lineage, **root-first**: original creation first, immediate
 * parent last. Resolved entirely from this server's rows — an upload
 * contributes only the immediate parent's id, checked against real rows before
 * it becomes a fork key, so a tampered chain can only lose attribution.
 *
 * A deleted ancestor ends the chain (the key is `ON DELETE SET NULL`), and so
 * does a repeated id, so corrupt data cannot loop the walk. One statement per
 * ancestor: real chains are a few entries long.
 */
export async function forkLineage(
  db: Queryable,
  table: CircuitTable,
  row: { id: string; forkedFromId: string | null }
): Promise<AncestorRow[]> {
  const chain: AncestorRow[] = [];
  const visited = new Set<string>([row.id]);
  let next = row.forkedFromId;

  while (next !== null && !visited.has(next)) {
    visited.add(next);
    const ancestor = await findAncestor(db, table, next);
    if (!ancestor) break;

    chain.push({
      id: ancestor.id,
      name: ancestor.name,
      link: ancestor.link,
      authorName: ancestor.authorName
    });
    next = ancestor.forkedFromId;
  }

  return chain.reverse();
}

async function findAncestor(
  db: Queryable,
  table: CircuitTable,
  id: string
): Promise<(AncestorRow & { forkedFromId: string | null }) | undefined> {
  const columns = {
    id: table.id,
    name: table.name,
    link: table.link,
    forkedFromId: table.forkedFromId,
    authorName: users.username
  };
  const [row] = await db
    .select(columns)
    .from(table)
    .innerJoin(users, eq(users.id, table.userId))
    .where(eq(table.id, id))
    .limit(1);
  return row;
}

/**
 * Whether the document a client claims to have forked exists here at all. Any
 * existing row is a legitimate parent, somebody else's included — the claim
 * only grants attribution to that document's real author. An unknown id drops
 * the claim silently rather than failing an otherwise good create.
 */
export async function forkParentExists(
  db: Queryable,
  table: CircuitTable,
  id: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  return row !== undefined;
}
