import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import type { CircuitDependencyEdge } from '@logigator/core';
import type { DocumentDependency } from '@logigator/contract';
import { DB, type Database, type Queryable } from '../database/database.module';
import {
  componentDependencies,
  components,
  projectDependencies
} from '../database/schema';

/**
 * Either edge table. Same three columns; two tables only so both foreign keys
 * can be real, a dependent being a project or a component and a dependency
 * always a component. Queries are written once and handed the table.
 */
type EdgeTable = typeof projectDependencies | typeof componentDependencies;

export const PROJECT_EDGES = projectDependencies;
export const COMPONENT_EDGES = componentDependencies;

/**
 * The dependency edges: which library components a stored circuit embeds. A
 * cache of what the document already says, extracted by the server on every
 * write and never asserted by a client — which is what makes them safe to
 * truncate and rebuild rather than diff.
 */
@Injectable()
export class DependenciesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Points a document's edges at exactly `edges`. Runs inside the caller's
   * transaction: an edge set not matching the document beside it must never be
   * observable.
   *
   * An edge naming a deleted component is skipped, not fatal. The document
   * embeds a frozen snapshot, and the cascade makes "snapshot, no edge" the
   * steady state after a delete — failing the save would let somebody else's
   * deletion break a circuit that does not need them.
   */
  async replace(
    tx: Queryable,
    table: EdgeTable,
    dependentId: string,
    edges: readonly CircuitDependencyEdge[]
  ): Promise<void> {
    await tx.delete(table).where(eq(table.dependentId, dependentId));
    if (edges.length === 0) return;

    const resolvable = await this.existing(
      tx,
      edges.map((edge) => edge.id)
    );
    const rows = edges
      .filter((edge) => resolvable.has(edge.id))
      .map((edge) => ({
        dependentId,
        dependencyId: edge.id,
        modelId: edge.model
      }));

    if (rows.length > 0) await tx.insert(table).values(rows);
  }

  /**
   * The masters a document embeds, as they stand now. An inner join, so a
   * deleted master is absent rather than a null-filled row — the client's cue
   * that its snapshot is all there is. `version` tells it an update exists.
   */
  async summaries(
    table: EdgeTable,
    dependentId: string
  ): Promise<DocumentDependency[]> {
    return this.db
      .select({
        model: table.modelId,
        id: components.id,
        version: components.version,
        name: components.name,
        symbol: components.symbol,
        description: components.description,
        numInputs: components.numInputs,
        numOutputs: components.numOutputs,
        labels: components.labels
      })
      .from(table)
      .innerJoin(components, eq(components.id, table.dependencyId))
      .where(eq(table.dependentId, dependentId));
  }

  private async existing(
    tx: Queryable,
    ids: readonly string[]
  ): Promise<Set<string>> {
    const rows = await tx
      .select({ id: components.id })
      .from(components)
      .where(inArray(components.id, [...ids]));
    return new Set(rows.map((row) => row.id));
  }
}
