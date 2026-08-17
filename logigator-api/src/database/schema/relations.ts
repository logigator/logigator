import { defineRelations } from 'drizzle-orm';
import { componentDependencies, projectDependencies } from './dependencies';
import { components, projects } from './documents';
import { componentStars, projectStars } from './stars';
import { users } from './users';

export const tables = {
  users,
  projects,
  components,
  projectDependencies,
  componentDependencies,
  projectStars,
  componentStars
};

/**
 * Relations for the relational query builder, declared separately from the
 * tables so the schema files stay pure DDL.
 *
 * This is RQBv2 (`defineRelations`), where relations are a query-time
 * convenience over explicit joins rather than a property of the tables: there
 * are no entity classes and nothing is loaded unless a query asks for it with
 * `with`. That is the point of the whole data-access choice — the legacy
 * `Promise<T>` lazy relations, and the `__proxy__` fields that existed only to
 * make them serializable, cannot come back this way.
 *
 * The star relations reach through the join tables, so a query can ask for a
 * user's starred projects without naming `project_stars`.
 */
export const relations = defineRelations(tables, (r) => ({
  // Every relation names its columns explicitly, and the two that run through a
  // join table carry a matching `alias` on both sides: a user has two distinct
  // relations to projects (owns, starred), and drizzle refuses to guess which
  // pairs with which.
  users: {
    projects: r.many.projects({ from: r.users.id, to: r.projects.userId }),
    components: r.many.components({
      from: r.users.id,
      to: r.components.userId
    }),
    starredProjects: r.many.projects({
      from: r.users.id.through(r.projectStars.userId),
      to: r.projects.id.through(r.projectStars.projectId),
      alias: 'project_stars'
    }),
    starredComponents: r.many.components({
      from: r.users.id.through(r.componentStars.userId),
      to: r.components.id.through(r.componentStars.componentId),
      alias: 'component_stars'
    })
  },
  projects: {
    user: r.one.users({
      from: r.projects.userId,
      to: r.users.id,
      optional: false
    }),
    forkedFrom: r.one.projects({
      from: r.projects.forkedFromId,
      to: r.projects.id
    }),
    forks: r.many.projects({
      from: r.projects.id,
      to: r.projects.forkedFromId
    }),
    dependencies: r.many.components({
      from: r.projects.id.through(r.projectDependencies.dependentId),
      to: r.components.id.through(r.projectDependencies.dependencyId),
      alias: 'project_dependencies'
    }),
    stargazers: r.many.users({
      from: r.projects.id.through(r.projectStars.projectId),
      to: r.users.id.through(r.projectStars.userId),
      alias: 'project_stars'
    })
  },
  components: {
    user: r.one.users({
      from: r.components.userId,
      to: r.users.id,
      optional: false
    }),
    forkedFrom: r.one.components({
      from: r.components.forkedFromId,
      to: r.components.id
    }),
    forks: r.many.components({
      from: r.components.id,
      to: r.components.forkedFromId
    }),
    dependencies: r.many.components({
      from: r.components.id.through(r.componentDependencies.dependentId),
      to: r.components.id.through(r.componentDependencies.dependencyId),
      alias: 'component_dependencies'
    }),
    dependents: r.many.components({
      from: r.components.id.through(r.componentDependencies.dependencyId),
      to: r.components.id.through(r.componentDependencies.dependentId),
      alias: 'component_dependents'
    }),
    stargazers: r.many.users({
      from: r.components.id.through(r.componentStars.componentId),
      to: r.users.id.through(r.componentStars.userId),
      alias: 'component_stars'
    })
  }
}));
