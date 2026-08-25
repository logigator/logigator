import { sql } from 'drizzle-orm';
import type { Database } from '../database/database.module';
import { componentDependencies, projectDependencies } from '../database/schema';

/**
 * Every library component a document needs, transitively.
 *
 * One recursive CTE rather than a query per level, which is what the legacy
 * backend did — `getRecursiveDependencies` walked the graph from Node, one round
 * trip per node, and a deep library made cloning proportional to network latency
 * instead of to the data.
 *
 * The path array is a cycle guard. The edge table cannot describe a cycle
 * through a single write — a document embeds snapshots, so its dependencies were
 * frozen before it existed — but two documents saved in the wrong order across a
 * clone can, and a recursive CTE that meets one does not terminate. Carrying the
 * path costs a comparison per row and removes the question.
 *
 * The root's own id is never in the result: a component that (somehow) depends on
 * itself would otherwise be cloned twice.
 */
export async function transitiveDependencyIds(
  db: Database,
  root: { kind: 'project' | 'component'; id: string }
): Promise<string[]> {
  // Only the first hop differs by kind — a dependent is a project or a
  // component, but every dependency is a component, so the recursion below is
  // always over the component edges.
  const firstHop =
    root.kind === 'project' ? projectDependencies : componentDependencies;

  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE reachable(id, path) AS (
        SELECT ${firstHop.dependencyId},
               ARRAY[${firstHop.dependentId}, ${firstHop.dependencyId}]
          FROM ${firstHop}
         WHERE ${firstHop.dependentId} = ${root.id}
      UNION ALL
        SELECT edge.dependency_id, reachable.path || edge.dependency_id
          FROM ${componentDependencies} edge
          JOIN reachable ON edge.dependent_id = reachable.id
         WHERE NOT (edge.dependency_id = ANY(reachable.path))
    )
    SELECT DISTINCT id FROM reachable WHERE id <> ${root.id}
  `);

  return result.rows.map((row) => row.id);
}
