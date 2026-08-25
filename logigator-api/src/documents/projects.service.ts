import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
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
import { circuitNotFound, versionConflict } from './circuit-errors';
import {
  findOwned,
  forkLineage,
  forkParentExists,
  nameMatches,
  pageOf
} from './circuit-queries';
import { toAttribution, toProjectSummary } from './circuit-responses';
import { DependenciesService, PROJECT_EDGES } from './dependencies.service';

/**
 * The caller's own boards.
 *
 * Everything a client can ask about a project it owns, and nothing about one it
 * does not: ownership is in every predicate, so this service has no notion of
 * reading somebody else's row and there is no check to forget. Public reads go
 * through the share and community endpoints instead, which is why those are
 * separate modules rather than a flag on these queries.
 *
 * The near-twin of `ComponentsService`. The two are not folded together because
 * the columns that differ are exactly the ones a write sets: a component derives
 * its port surface from its circuit, and a project has none. Sharing the reads
 * that touch only the common half — `circuit-queries.ts` — is where the
 * duplication actually was.
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
   * Creates a project, optionally with a document already in it.
   *
   * The whole thing is one transaction because the edges are derived from the
   * document: a row whose dependency edges do not describe the circuit beside
   * them is the state this pair must never be observed in, and a create that
   * failed halfway would leave exactly that.
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
          public: body.public ?? false,
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
   * Replaces the circuit, if nothing else has since the client read it.
   *
   * The counter in the `WHERE` is the whole concurrency mechanism, and it works
   * because the check and the write are one statement — a read-then-write would
   * leave a window in which both tabs see the version they expect.
   *
   * The name is not taken from the document. A save is about the circuit;
   * renaming is a metadata change with its own route and its own validated
   * length. So the column's name is written back into the document, and the two
   * cannot disagree about it whatever a client sent.
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

      // Nothing matched, and the row existed a moment ago: either the version
      // moved or the project is gone. One read on the failure path buys the
      // difference between "reload" and "it is not there any more".
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
   * Changes metadata. A rename rewrites the document's own copy of the name, so
   * the column stays the one place a name is set.
   *
   * `version` bumps for a rename or a new description, and not for visibility or
   * a fresh share token. The rule is the same on both kinds and it is about what
   * the counter *means*: it stamps everything a placed instance or an open editor
   * would have to re-read. Whether a document is public is neither — and for
   * components, where the same counter is what offers an instance an update,
   * bumping it there would ask every board using the component to accept a change
   * that is invisible to it.
   */
  async update(
    userId: string,
    id: string,
    body: UpdateProjectRequest
  ): Promise<ProjectSummary> {
    const existing = await this.require(userId, id);
    const name = body.name ?? existing.name;
    const contentChanged =
      body.name !== undefined || body.description !== undefined;

    const [row] = await this.db
      .update(projects)
      .set({
        name,
        ...(body.description === undefined
          ? {}
          : { description: body.description }),
        ...(body.public === undefined ? {} : { public: body.public }),
        ...(body.regenerateLink ? { link: randomUUID() } : {}),
        ...(body.name === undefined
          ? {}
          : { document: { ...existing.document, name } }),
        ...(contentChanged
          ? { version: existing.version + 1, lastEditedAt: new Date() }
          : {})
      })
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .returning();

    if (!row) throw circuitNotFound('project');
    return toProjectSummary(row);
  }

  /**
   * Deletes the project. Its edges and stars go with it through the cascade;
   * the preview follows, since a file on a volume has no foreign key to follow.
   *
   * The row goes first, so a failed unlink leaves an orphan for the sweep rather
   * than a row pointing at nothing.
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
