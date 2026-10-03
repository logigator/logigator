import { index, integer, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { components, projects } from './documents';

/**
 * Which library components a stored circuit embeds, extracted from the document
 * by the server on every write and never asserted by the client. The rows are a
 * rebuildable cache of the document column.
 *
 * `modelId` is the document-local type id the instances reference. A document
 * carries at most one snapshot per master, hence the composite primary key.
 *
 * The two tables are separate rather than one polymorphic edge table so both
 * foreign keys stay real: a dependent is a project or a component, but a
 * dependency is always a component.
 */
export const projectDependencies = pgTable(
  'project_dependencies',
  {
    dependentId: uuid('dependent_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    dependencyId: uuid('dependency_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    modelId: integer('model_id').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.dependentId, t.dependencyId] }),
    // The reverse direction — which circuits break if this component goes
    // away — and the recursive dependency-graph CTE's join column.
    index('project_dependencies_dependency_idx').on(t.dependencyId)
  ]
);

export const componentDependencies = pgTable(
  'component_dependencies',
  {
    dependentId: uuid('dependent_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    dependencyId: uuid('dependency_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    modelId: integer('model_id').notNull()
  },
  (t) => [
    primaryKey({ columns: [t.dependentId, t.dependencyId] }),
    index('component_dependencies_dependency_idx').on(t.dependencyId)
  ]
);

export type ProjectDependencyRow = typeof projectDependencies.$inferSelect;
export type ComponentDependencyRow = typeof componentDependencies.$inferSelect;
