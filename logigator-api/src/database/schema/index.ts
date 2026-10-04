/**
 * The database schema, in TypeScript. `drizzle-kit` diffs these tables into the
 * SQL migrations under `drizzle/`, which are the source of truth for the DDL;
 * nothing is ever pushed straight to a database.
 */
export * from './users';
export * from './documents';
export * from './dependencies';
export * from './stars';
export { relations, tables } from './relations';
