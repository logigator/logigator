import { sql } from 'drizzle-orm';
import type { Database } from '../database/database.module';
import { componentDependencies, projectDependencies } from '../database/schema';

/**
 * Every library component a document needs, transitively: one recursive CTE
 * rather than a round trip per node.
 *
 * The path array is a cycle guard. A single write cannot create a cycle — a
 * document embeds snapshots, frozen before it existed — but two documents
 * saved in the wrong order across a clone can, and a recursive CTE that meets
 * one does not terminate.
 *
 * The root's own id is excluded, so a self-dependency is not cloned twice.
 */
export async function transitiveDependencyIds(
  db: Database,
  root: { kind: 'project' | 'component'; id: string }
): Promise<string[]> {
  // Only the first hop differs by kind: every dependency is a component, so
  // the recursion is always over the component edges.
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
