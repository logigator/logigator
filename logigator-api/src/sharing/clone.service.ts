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
import { FileStorageService } from '../storage/file-storage.service';
import { transitiveDependencyIds } from './dependency-graph';
import {
  ShareService,
  type ShareKind,
  type ShareTarget
} from './share.service';

/** Original component id → the id its copy will have. */
type IdMap = ReadonlyMap<string, string>;

/** Original row id → the preview asset its copy points at. */
type PreviewMap = ReadonlyMap<string, string>;

/**
 * Taking a copy of a shared document into your own account.
 *
 * A *read* needs nothing cloned — a document is self-contained. A working copy
 * needs masters of its own to keep editing, so the whole transitive dependency
 * graph comes along and every embedded snapshot is re-pointed at the new ids: a
 * copy left pointing at the originals would hear about updates to somebody
 * else's components and never about its own.
 *
 * New ids are chosen before any insert, so insert order is irrelevant — every
 * document is rewritten against the complete map, with no topological sort and
 * no fix-up pass.
 *
 * Previews come along as copies of the originals' assets. Re-pointing sources
 * changes no pixel, and the copy is not the only document that needs one: a
 * dependency the cloner never opens would otherwise stay a placeholder on their
 * shelf for good, the editor being the only thing that renders.
 */
@Injectable()
export class CloneService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly share: ShareService,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService,
    private readonly files: FileStorageService
  ) {}

  async cloneByLink(
    userId: string,
    kind: ShareKind,
    link: string
  ): Promise<CloneResponse> {
    // The cloner is the caller, so a document they own is one they can copy
    // out of its private state; anybody else's has to be one the link resolves
    // for them.
    const target = await this.share.resolve(kind, link, userId);
    const sources = await this.dependencyRows(target);
    const idMap = new Map(sources.map((row) => [row.id, randomUUID()]));
    const previews = await this.copyPreviews([target.row, ...sources]);

    try {
      // One transaction over the lot: a half-cloned library is a set of
      // documents whose snapshots name masters that were never created.
      return await this.db.transaction(async (tx) => {
        const copies: ComponentSummary[] = [];
        for (const source of sources) {
          copies.push(
            toComponentSummary(
              await this.copyComponent(tx, userId, source, idMap, previews)
            )
          );
        }

        if (target.kind === 'project') {
          const project = await this.copyProject(
            tx,
            userId,
            target.row,
            idMap,
            previews
          );
          return {
            kind: 'project',
            project: toProjectSummary(project),
            dependencies: copies
          };
        }

        const component = await this.copyComponent(
          tx,
          userId,
          target.row,
          idMap,
          previews
        );
        return {
          kind: 'component',
          component: toComponentSummary(component),
          dependencies: copies
        };
      });
    } catch (error) {
      // Nothing names the copies; removing them here saves the sweep the work.
      await Promise.all(
        [...previews.values()].map((id) =>
          this.files.removeAsset('preview', id)
        )
      );
      throw error;
    }
  }

  /**
   * Written before the transaction opens, so it holds no rows while the disk
   * works; a copy whose row never commits is an orphan the sweep's grace
   * window already accounts for. A source whose asset is gone clones without a
   * preview rather than failing the clone.
   */
  private async copyPreviews(
    rows: readonly (ProjectRow | ComponentRow)[]
  ): Promise<PreviewMap> {
    const copies = await Promise.all(
      rows.map(async (row) => {
        const copy = row.previewId
          ? await this.files.copyAsset('preview', row.previewId)
          : null;
        return copy ? ([row.id, copy] as const) : null;
      })
    );
    return new Map(copies.filter((entry) => entry !== null));
  }

  /**
   * The masters the copy will need, read outside the transaction: a clone
   * captures a snapshot either way, so holding one across the walk would only
   * contend with whoever is editing the original.
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
    idMap: IdMap,
    previews: PreviewMap
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
        // Inheriting the original's visibility would publish somebody else's
        // work under a new owner as a side effect of taking a copy, so the copy
        // starts unlisted: not in any listing, with a link its new owner holds
        // alone and can revoke.
        visibility: 'unlisted',
        document: ingested.document,
        formatVersion: ingested.formatVersion,
        componentCount: ingested.componentCount,
        wireCount: ingested.wireCount,
        previewId: previews.get(source.id) ?? null,
        // The attribution trust anchor: every author in the chain is derived
        // from these keys.
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
    idMap: IdMap,
    previews: PreviewMap
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
        visibility: 'unlisted',
        document: ingested.document,
        formatVersion: ingested.formatVersion,
        componentCount: ingested.componentCount,
        wireCount: ingested.wireCount,
        // Re-derived, not copied, like any other write: the ports are the plugs
        // in the circuit, and the circuit was just rewritten.
        numInputs: ingested.summary.numInputs,
        numOutputs: ingested.summary.numOutputs,
        labels: ingested.summary.labels,
        previewId: previews.get(source.id) ?? null,
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
 * Re-points a document's embedded snapshots at the copies of their masters. A
 * source missing from the map names a master that does not exist, so its
 * `source` is dropped — a snapshot without one is self-contained, which the
 * format already has a meaning for.
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
