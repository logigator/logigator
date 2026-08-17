import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { components, projects } from './documents';
import { users } from './users';

/**
 * Stars, as two plain join tables. A count is a `count(*)` over the index on the
 * starred side rather than a counter column: the community listings read it in
 * aggregate anyway, and a denormalized counter is one more thing that can drift
 * from the rows it summarizes.
 */
export const projectStars = pgTable(
  'project_stars',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    starredAt: timestamp('starred_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.projectId] }),
    index('project_stars_project_idx').on(t.projectId)
  ]
);

export const componentStars = pgTable(
  'component_stars',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    componentId: uuid('component_id')
      .notNull()
      .references(() => components.id, { onDelete: 'cascade' }),
    starredAt: timestamp('starred_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.componentId] }),
    index('component_stars_component_idx').on(t.componentId)
  ]
);
