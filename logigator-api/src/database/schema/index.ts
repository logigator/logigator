/**
 * The database schema, in TypeScript. `drizzle-kit` diffs these tables to
 * generate the SQL migrations under `drizzle/`, which are the checked-in,
 * reviewable source of truth for the actual DDL; nothing is ever pushed
 * straight to a production database.
 */
export * from './users';
export * from './documents';
export * from './dependencies';
export * from './stars';
export { relations, tables } from './relations';
