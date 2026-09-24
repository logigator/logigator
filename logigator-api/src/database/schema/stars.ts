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
 * Stars, as two plain join tables. A count is a `count(*)` over the index on
 * the starred side rather than a counter column that can drift.
 *
 * That index carries `starred_at` as its second column, which is what makes
 * the trending ranking an indexed range rather than a scan: the composite still
 * serves the plain equality lookups the tally and the caller's-star `EXISTS`
 * do, so counting the stars inside a window costs no extra index.
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
    index('project_stars_project_idx').on(t.projectId, t.starredAt)
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
    index('component_stars_component_idx').on(t.componentId, t.starredAt)
  ]
);
