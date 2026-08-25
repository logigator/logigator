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
 * Either edge table. The two carry the same three columns and exist separately
 * only so both foreign keys can be real — a dependent is a project or a
 * component, a dependency is always a component — so every query over them is
 * written once and handed the table.
 */
type EdgeTable = typeof projectDependencies | typeof componentDependencies;

export const PROJECT_EDGES = projectDependencies;
export const COMPONENT_EDGES = componentDependencies;

/**
 * The dependency edges: which library components a stored circuit embeds.
 *
 * These rows are a cache of what the document already says, extracted by the
 * server on every write and never asserted by a client — which is the whole
 * difference from the legacy API, where the save body listed its own
 * dependencies and nothing checked them against the circuit. Being derived is
 * also what makes them safe to truncate and rebuild, and what lets a write
 * simply replace a document's whole edge set rather than diff it.
 */
@Injectable()
export class DependenciesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Points a document's edges at exactly `edges`, dropping whatever it had.
   *
   * Runs inside the caller's transaction, because an edge set that does not
   * match the document beside it is the one state this table must never be
   * observed in.
   *
   * Edges naming a component that no longer exists are skipped rather than
   * fatal. A document embeds a frozen snapshot of everything it uses, so it
   * keeps working when a master is deleted — and the cascade on the dependency
   * key means "snapshot embedded, no edge" is already the steady state after a
   * delete, not an anomaly. Failing the save instead would make somebody else's
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
   * The masters a document embeds, as they stand now.
   *
   * An inner join, so a master that has since been deleted is absent rather than
   * a null-filled row — the client's cue that its embedded snapshot is all there
   * is. `version` against the snapshot's own is what tells it an update exists.
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

  /** Which of `ids` are component rows, so the rest can be skipped. */
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
