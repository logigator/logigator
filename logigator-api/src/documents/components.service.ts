import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  ComponentResponse,
  ComponentSummary,
  CreateComponentRequest,
  Page,
  PageQuery,
  SaveCircuitRequest,
  UpdateComponentRequest
} from '@logigator/contract';
import { DB, type Database } from '../database/database.module';
import { components, type ComponentRow } from '../database/schema';
import { FileStorageService } from '../storage/file-storage.service';
import { CircuitDocumentService } from './circuit-document.service';
import { circuitNotFound, versionConflict } from './circuit-errors';
import {
  findOwned,
  forkLineage,
  forkParentExists,
  nameMatches,
  pageOf
} from './circuit-queries';
import { toAttribution, toComponentSummary } from './circuit-responses';
import { COMPONENT_EDGES, DependenciesService } from './dependencies.service';
import { renameInDocument } from './rename-in-document';

/**
 * The caller's own library components.
 *
 * `ProjectsService`' twin, with the one difference that motivates keeping them
 * apart: a component is placed inside other circuits, so it also stores the port
 * surface a placed instance renders from — and that surface is **derived from
 * its document on every write**, never sent by a client. A circuit's ports are
 * the plugs in it, so a declared count is a claim that can disagree with the
 * circuit it describes, and the boards embedding this component are what would
 * render wrong.
 */
@Injectable()
export class ComponentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService,
    private readonly files: FileStorageService
  ) {}

  list(userId: string, query: PageQuery): Promise<Page<ComponentRow>> {
    return pageOf(
      this.db,
      components,
      and(
        eq(components.userId, userId),
        nameMatches(components.name, query.search)
      ),
      query
    );
  }

  async open(userId: string, id: string): Promise<ComponentResponse> {
    const row = await this.require(userId, id);
    const [dependencies, lineage] = await Promise.all([
      this.dependencies.summaries(COMPONENT_EDGES, row.id),
      forkLineage(this.db, components, row)
    ]);

    return {
      ...toComponentSummary(row),
      document: this.documents.read(row.document, row.id),
      dependencies,
      attribution: toAttribution(lineage)
    };
  }

  async create(
    userId: string,
    body: CreateComponentRequest
  ): Promise<ComponentSummary> {
    const ingested = this.documents.ingest(body.document, body.name);
    const forkedFromId = await this.resolveParent(ingested.claimedParentId);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(components)
        .values({
          userId,
          name: body.name,
          symbol: body.symbol,
          description: body.description ?? '',
          public: body.public ?? false,
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount,
          numInputs: ingested.summary.numInputs,
          numOutputs: ingested.summary.numOutputs,
          labels: ingested.summary.labels,
          forkedFromId
        })
        .returning();

      await this.dependencies.replace(
        tx,
        COMPONENT_EDGES,
        row.id,
        ingested.dependencies
      );
      return toComponentSummary(row);
    });
  }

  /**
   * Replaces the circuit and re-derives the ports it exposes.
   *
   * Adding a plug is therefore an interface change with no separate step: the
   * next board to open picks up the new arity from the version bump this write
   * already carries.
   */
  async save(
    userId: string,
    id: string,
    body: SaveCircuitRequest
  ): Promise<ComponentSummary> {
    const existing = await this.require(userId, id);
    const ingested = this.documents.ingest(body.document, existing.name);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(components)
        .set({
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount,
          numInputs: ingested.summary.numInputs,
          numOutputs: ingested.summary.numOutputs,
          labels: ingested.summary.labels,
          version: body.version + 1,
          lastEditedAt: new Date()
        })
        .where(
          and(
            eq(components.id, id),
            eq(components.userId, userId),
            eq(components.version, body.version)
          )
        )
        .returning();

      if (!row) {
        throw (await findOwned(tx, components, userId, id))
          ? versionConflict()
          : circuitNotFound('component');
      }

      await this.dependencies.replace(
        tx,
        COMPONENT_EDGES,
        id,
        ingested.dependencies
      );
      return toComponentSummary(row);
    });
  }

  /**
   * Changes metadata. Name, symbol and description all travel inside every
   * placed snapshot, so each of them bumps `version` and every instance frozen at
   * an older one is offered the update. Visibility and the share token are not
   * snapshot content and leave the counter alone.
   */
  async update(
    userId: string,
    id: string,
    body: UpdateComponentRequest
  ): Promise<ComponentSummary> {
    const contentChanged =
      body.name !== undefined ||
      body.symbol !== undefined ||
      body.description !== undefined;

    const changes = {
      ...(body.name === undefined
        ? {}
        : {
            name: body.name,
            document: renameInDocument(components.document, body.name)
          }),
      ...(body.symbol === undefined ? {} : { symbol: body.symbol }),
      ...(body.description === undefined
        ? {}
        : { description: body.description }),
      ...(body.public === undefined ? {} : { public: body.public }),
      ...(body.regenerateLink ? { link: randomUUID() } : {}),
      ...(contentChanged
        ? { version: sql`${components.version} + 1`, lastEditedAt: new Date() }
        : {})
    };

    if (Object.keys(changes).length === 0) {
      return toComponentSummary(await this.require(userId, id));
    }

    const [row] = await this.db
      .update(components)
      .set(changes)
      .where(and(eq(components.id, id), eq(components.userId, userId)))
      .returning();

    if (!row) throw circuitNotFound('component');
    return toComponentSummary(row);
  }

  /**
   * Deletes the component.
   *
   * The boards that embed it keep working: a document carries a frozen snapshot
   * of everything it uses, so what the cascade removes is the edge recording
   * where the snapshot came from, not the circuit itself. That is the whole
   * reason a delete needs no dependent check.
   */
  async delete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(components)
      .where(and(eq(components.id, id), eq(components.userId, userId)))
      .returning();

    if (!row) throw circuitNotFound('component');
    if (row.previewId) await this.files.removeAsset('preview', row.previewId);
  }

  private async require(userId: string, id: string): Promise<ComponentRow> {
    const row = await findOwned(this.db, components, userId, id);
    if (!row) throw circuitNotFound('component');
    return row;
  }

  private async resolveParent(claimed: string | null): Promise<string | null> {
    if (!claimed) return null;
    return (await forkParentExists(this.db, components, claimed))
      ? claimed
      : null;
  }
}
