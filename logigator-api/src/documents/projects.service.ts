import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type {
  CreateProjectRequest,
  Page,
  PageQuery,
  ProjectResponse,
  ProjectSummary,
  SaveCircuitRequest,
  UpdateProjectRequest
} from '@logigator/contract';
import { DB, type Database } from '../database/database.module';
import { projects, type ProjectRow } from '../database/schema';
import { FileStorageService } from '../storage/file-storage.service';
import { CircuitDocumentService } from './circuit-document.service';
import {
  circuitNotFound,
  linkPublished,
  versionConflict
} from './circuit-errors';
import {
  findOwned,
  forkLineage,
  forkParentExists,
  nameMatches,
  pageOf
} from './circuit-queries';
import { toAttribution, toProjectSummary } from './circuit-responses';
import { DependenciesService, PROJECT_EDGES } from './dependencies.service';
import { renameInDocument } from './rename-in-document';

/**
 * The caller's own boards. Ownership is in every predicate, so this service has
 * no notion of reading somebody else's row; public reads go through the share
 * and community modules.
 *
 * The near-twin of `ComponentsService`, kept apart because the columns that
 * differ are exactly the ones a write sets — a component derives a port surface
 * from its circuit, a project has none. The common reads are shared through
 * `circuit-queries.ts`.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService,
    private readonly files: FileStorageService
  ) {}

  list(userId: string, query: PageQuery): Promise<Page<ProjectRow>> {
    return pageOf(
      this.db,
      projects,
      and(
        eq(projects.userId, userId),
        nameMatches(projects.name, query.search)
      ),
      query
    );
  }

  /**
   * A project opened for editing: the document, plus what the document cannot
   * say about itself — how its dependencies' masters stand now, and whose work
   * it descends from.
   */
  async open(userId: string, id: string): Promise<ProjectResponse> {
    const row = await this.require(userId, id);
    const [dependencies, lineage] = await Promise.all([
      this.dependencies.summaries(PROJECT_EDGES, row.id),
      forkLineage(this.db, projects, row)
    ]);

    return {
      ...toProjectSummary(row),
      document: this.documents.read(row.document, row.id),
      dependencies,
      attribution: toAttribution(lineage)
    };
  }

  /**
   * Creates a project, optionally with a document already in it. One
   * transaction: the edges are derived from the document, and a row whose edges
   * do not describe the circuit beside them must never be observable.
   */
  async create(
    userId: string,
    body: CreateProjectRequest
  ): Promise<ProjectSummary> {
    const ingested = this.documents.ingest(body.document, body.name);
    const forkedFromId = await this.resolveParent(ingested.claimedParentId);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(projects)
        .values({
          userId,
          name: body.name,
          description: body.description ?? '',
          // Absent means `unlisted`: a document created by a client that names
          // no state is one nobody was told about, and a link that resolves is
          // what its owner needs to hand it out.
          visibility: body.visibility ?? 'unlisted',
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount,
          forkedFromId
        })
        .returning();

      await this.dependencies.replace(
        tx,
        PROJECT_EDGES,
        row.id,
        ingested.dependencies
      );
      return toProjectSummary(row);
    });
  }

  /**
   * Replaces the circuit, if nothing else has since the client read it. The
   * counter in the `WHERE` is the whole concurrency mechanism, and it works
   * because the check and the write are one statement.
   *
   * The name comes from the column, not the document: renaming is a metadata
   * change with its own route, so the two cannot disagree whatever a client
   * sent.
   */
  async save(
    userId: string,
    id: string,
    body: SaveCircuitRequest
  ): Promise<ProjectSummary> {
    const existing = await this.require(userId, id);
    const ingested = this.documents.ingest(body.document, existing.name);

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(projects)
        .set({
          document: ingested.document,
          formatVersion: ingested.formatVersion,
          componentCount: ingested.componentCount,
          wireCount: ingested.wireCount,
          version: body.version + 1,
          lastEditedAt: new Date()
        })
        .where(
          and(
            eq(projects.id, id),
            eq(projects.userId, userId),
            eq(projects.version, body.version)
          )
        )
        .returning();

      // Nothing matched though the row existed a moment ago: one read on the
      // failure path tells a moved version from a deleted project.
      if (!row) {
        throw (await findOwned(tx, projects, userId, id))
          ? versionConflict()
          : circuitNotFound('project');
      }

      await this.dependencies.replace(
        tx,
        PROJECT_EDGES,
        id,
        ingested.dependencies
      );
      return toProjectSummary(row);
    });
  }

  /**
   * Changes metadata. A rename rewrites the document's own copy of the name in
   * the same statement, so a save landing at the same moment keeps its circuit.
   *
   * `version` stamps what a placed instance or an open editor must re-read, so
   * it bumps for a rename or description and not for visibility or a fresh
   * share token — bumping it on those would offer every board using a component
   * an update it cannot see.
   *
   * The link is the document's address, and a visibility change leaves it
   * exactly where it was: `private → unlisted` restores the same URL, so hiding
   * a document never breaks a bookmark or a link somebody already copied.
   * Revocation is the explicit act, `regenerateLink`, and that one is refused
   * while the document is public — the page's own URL *is* this link. Which
   * state the document is in is what decides the refusal, so this reads the row
   * before it writes; the body alone cannot say it. Read only where the
   * rotation is actually asked for: a rename or a visibility pick needs no such
   * answer, and the update below reports a row that is not there.
   */
  async update(
    userId: string,
    id: string,
    body: UpdateProjectRequest
  ): Promise<ProjectSummary> {
    if (body.regenerateLink) {
      const existing = await this.require(userId, id);
      if (existing.visibility === 'public') {
        throw linkPublished('project');
      }
    }

    const contentChanged =
      body.name !== undefined || body.description !== undefined;

    const changes = {
      ...(body.name === undefined
        ? {}
        : {
            name: body.name,
            document: renameInDocument(projects.document, body.name)
          }),
      ...(body.description === undefined
        ? {}
        : { description: body.description }),
      ...(body.visibility === undefined ? {} : { visibility: body.visibility }),
      ...(body.regenerateLink ? { link: randomUUID() } : {}),
      ...(contentChanged
        ? { version: sql`${projects.version} + 1`, lastEditedAt: new Date() }
        : {})
    };

    // An `UPDATE` with an empty `SET` is not a statement, so a body that asks
    // for nothing is answered with the row as it stands.
    if (Object.keys(changes).length === 0) {
      return toProjectSummary(await this.require(userId, id));
    }

    const [row] = await this.db
      .update(projects)
      .set(changes)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!row) throw circuitNotFound('project');
    return toProjectSummary(row);
  }

  /**
   * Deletes the project. Edges and stars go with it through the cascade; the
   * preview has no foreign key, so it is unlinked here — after the row, so a
   * failed unlink leaves an orphan for the sweep rather than a dangling row.
   */
  async delete(userId: string, id: string): Promise<void> {
    const [row] = await this.db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!row) throw circuitNotFound('project');
    if (row.previewId) await this.files.removeAsset('preview', row.previewId);
  }

  private async require(userId: string, id: string): Promise<ProjectRow> {
    const row = await findOwned(this.db, projects, userId, id);
    if (!row) throw circuitNotFound('project');
    return row;
  }

  private async resolveParent(claimed: string | null): Promise<string | null> {
    if (!claimed) return null;
    return (await forkParentExists(this.db, projects, claimed))
      ? claimed
      : null;
  }
}
