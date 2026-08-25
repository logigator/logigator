import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { CloneResponse, ComponentSummary } from '@logigator/contract';
import type { CurrentCircuitFile } from '@logigator/core';
import {
  DB,
  type Database,
  type Transaction
} from '../database/database.module';
import {
  components,
  projects,
  type ComponentRow,
  type ProjectRow
} from '../database/schema';
import { CircuitDocumentService } from '../documents/circuit-document.service';
import {
  toComponentSummary,
  toProjectSummary
} from '../documents/circuit-responses';
import {
  COMPONENT_EDGES,
  DependenciesService,
  PROJECT_EDGES
} from '../documents/dependencies.service';
import { transitiveDependencyIds } from './dependency-graph';
import { ShareService, type ShareTarget } from './share.service';

/** Original component id → the id its copy will have. */
type IdMap = ReadonlyMap<string, string>;

/**
 * Taking a copy of a shared document into your own account.
 *
 * A document is self-contained, so a *read* needs nothing cloned. A working copy
 * is different: to keep editing the components it uses, the cloner needs masters
 * of their own — so the whole transitive dependency graph comes along, and every
 * embedded snapshot in every copied document is re-pointed at the new ids.
 *
 * That rewrite is the part the legacy version had no need for, and the part that
 * matters most. Its dependencies were rows the response carried, so remapping
 * them was remapping rows; here the provenance lives inside the document, and a
 * copy left pointing at the original masters would be told about updates to
 * somebody else's components and could never be told about its own.
 *
 * The new ids are chosen before anything is inserted. That is what makes the
 * order irrelevant: every document can be rewritten against the complete map, so
 * there is no topological sort to get wrong and no second pass to fix up.
 */
@Injectable()
export class CloneService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly share: ShareService,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService
  ) {}

  async cloneByLink(userId: string, link: string): Promise<CloneResponse> {
    const target = await this.share.resolve(link);
    const sources = await this.dependencyRows(target);
    const idMap = new Map(sources.map((row) => [row.id, randomUUID()]));

    // One transaction over the lot: a half-cloned library is a set of documents
    // whose snapshots name masters that were never created.
    return this.db.transaction(async (tx) => {
      const copies: ComponentSummary[] = [];
      for (const source of sources) {
        copies.push(
          toComponentSummary(
            await this.copyComponent(tx, userId, source, idMap)
          )
        );
      }

      if (target.kind === 'project') {
        const project = await this.copyProject(tx, userId, target.row, idMap);
        return {
          kind: 'project',
          project: toProjectSummary(project),
          dependencies: copies
        };
      }

      const component = await this.copyComponent(tx, userId, target.row, idMap);
      return {
        kind: 'component',
        component: toComponentSummary(component),
        dependencies: copies
      };
    });
  }

  /**
   * The masters the copy will need, read before the transaction opens.
   *
   * Deliberately outside it: the graph a clone captures is a snapshot either
   * way — that is what cloning is — so holding a transaction across the walk
   * would buy nothing but contention with whoever is editing the original.
   */
  private async dependencyRows(target: ShareTarget): Promise<ComponentRow[]> {
    const ids = await transitiveDependencyIds(this.db, {
      kind: target.kind,
      id: target.row.id
    });
    if (ids.length === 0) return [];

    return this.db.select().from(components).where(inArray(components.id, ids));
  }

  private async copyProject(
    tx: Transaction,
    userId: string,
    source: ProjectRow,
    idMap: IdMap
  ): Promise<ProjectRow> {
    const ingested = this.documents.ingest(
      remapSources(source.document, idMap),
      source.name
    );

    const [row] = await tx
      .insert(projects)
      .values({
        id: idMap.get(source.id) ?? randomUUID(),
        userId,
        name: source.name,
        description: source.description,
        // A copy is the cloner's own private draft until they choose otherwise.
        // Inheriting the original's visibility would republish somebody else's
        // work under a new owner as a side effect of taking a copy.
        public: false,
        document: ingested.document,
        formatVersion: ingested.formatVersion,
        componentCount: ingested.componentCount,
        wireCount: ingested.wireCount,
        // The trust anchor for attribution: the copy records what it came from,
        // and every author in the chain is derived from these keys.
        forkedFromId: source.id
      })
      .returning();

    await this.dependencies.replace(
      tx,
      PROJECT_EDGES,
      row.id,
      ingested.dependencies
    );
    return row;
  }

  private async copyComponent(
    tx: Transaction,
    userId: string,
    source: ComponentRow,
    idMap: IdMap
  ): Promise<ComponentRow> {
    const ingested = this.documents.ingest(
      remapSources(source.document, idMap),
      source.name
    );

    const [row] = await tx
      .insert(components)
      .values({
        id: idMap.get(source.id) ?? randomUUID(),
        userId,
        name: source.name,
        symbol: source.symbol,
        description: source.description,
        public: false,
        document: ingested.document,
        formatVersion: ingested.formatVersion,
        componentCount: ingested.componentCount,
        wireCount: ingested.wireCount,
        // Re-derived rather than copied, like any other write: the ports are the
        // plugs in the circuit, and the circuit is what was just rewritten.
        numInputs: ingested.summary.numInputs,
        numOutputs: ingested.summary.numOutputs,
        labels: ingested.summary.labels,
        forkedFromId: source.id
      })
      .returning();

    await this.dependencies.replace(
      tx,
      COMPONENT_EDGES,
      row.id,
      ingested.dependencies
    );
    return row;
  }
}

/**
 * Re-points a document's embedded snapshots at the copies of their masters.
 *
 * A source with no entry in the map names a master that does not exist — the
 * graph is walked over the edges, and an edge exists for every server-origin
 * source whose master does. So its `source` is dropped rather than carried:
 * without a master it *is* a self-contained snapshot, which the format already
 * has a meaning for, and keeping a dead id would leave the copy asking about a
 * document nobody can see.
 */
function remapSources(
  document: CurrentCircuitFile,
  idMap: IdMap
): CurrentCircuitFile {
  if (!document.definitions?.length) return document;

  return {
    ...document,
    definitions: document.definitions.map((definition) => {
      const source = definition.source;
      if (source?.origin !== 'server') return definition;

      const copied = idMap.get(source.id);
      if (!copied) {
        const orphaned = { ...definition };
        delete orphaned.source;
        return orphaned;
      }
      return { ...definition, source: { ...source, id: copied } };
    })
  };
}
