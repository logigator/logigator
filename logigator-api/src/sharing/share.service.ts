import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { ShareResponse } from '@logigator/contract';
import { starTally } from '../community/star-queries';
import { ApiException } from '../common/api-exception';
import { DB, type Database } from '../database/database.module';
import {
  componentStars,
  components,
  projectStars,
  projects,
  users,
  type ComponentRow,
  type ProjectRow,
  type UserRow
} from '../database/schema';
import { CircuitDocumentService } from '../documents/circuit-document.service';
import { findByResolvingLink, forkLineage } from '../documents/circuit-queries';
import {
  toAttribution,
  toAuthor,
  toComponentSummary,
  toProjectSummary
} from '../documents/circuit-responses';
import {
  COMPONENT_EDGES,
  DependenciesService,
  PROJECT_EDGES
} from '../documents/dependencies.service';

/** The two kinds of document a link can address, as the API spells them. */
export type ShareKind = 'project' | 'component';

/** What a share link turned out to point at. */
export type ShareTarget =
  | { kind: 'project'; row: ProjectRow }
  | { kind: 'component'; row: ComponentRow };

/**
 * Reading a document through its share link. The link is the document's
 * address, and what it resolves to is the state its owner put it in: everything
 * but a private document, which resolves for its owner alone. Holding the URL
 * is what lets a stranger read an unlisted one — no session needed — and
 * revoking one is the explicit act of minting a new token. A state change only
 * masks the address: a private document is one nobody else can open by it, and
 * the same URL resolves again the moment it is unlisted.
 *
 * The kind is part of the address because the token no longer identifies its
 * table on its own, `/share/{kind}/{link}` naming one row of one of them.
 *
 * Hence a uuid in its own column rather than the document's id, which is
 * guessable from any other reference and cannot be rotated.
 */
@Injectable()
export class ShareService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly documents: CircuitDocumentService,
    private readonly dependencies: DependenciesService
  ) {}

  /**
   * The row this link addresses, if it resolves for this caller. One branch per
   * kind rather than a search across both tables: which one to look in is said
   * by the URL, and a search would have to decide which table wins when a
   * token — by now a random uuid in two independent columns — happened to name
   * a row in each.
   *
   * The predicate is the read's own, not a check afterwards, so the card and
   * the clone that come through here answer for exactly the documents the read
   * does.
   */
  async resolve(
    kind: ShareKind,
    link: string,
    callerId: string | null
  ): Promise<ShareTarget> {
    if (kind === 'component') {
      const row = await findByResolvingLink(
        this.db,
        components,
        link,
        callerId
      );
      if (row) return { kind: 'component', row };
    } else {
      const row = await findByResolvingLink(this.db, projects, link, callerId);
      if (row) return { kind: 'project', row };
    }

    throw new ApiException(
      HttpStatus.NOT_FOUND,
      'not_found',
      'No such share link.'
    );
  }

  async read(
    kind: ShareKind,
    link: string,
    callerId: string | null
  ): Promise<ShareResponse> {
    const target = await this.resolve(kind, link, callerId);
    const table = target.kind === 'project' ? projects : components;

    const [author, dependencies, lineage, stars] = await Promise.all([
      this.author(target.row.userId),
      this.dependencies.summaries(
        target.kind === 'project' ? PROJECT_EDGES : COMPONENT_EDGES,
        target.row.id
      ),
      forkLineage(this.db, table, target.row),
      this.stars(target)
    ]);

    const shared = {
      document: this.documents.read(target.row.document, target.row.id),
      dependencies,
      attribution: toAttribution(lineage),
      author,
      stars
    };

    return target.kind === 'project'
      ? { kind: 'project', project: toProjectSummary(target.row), ...shared }
      : {
          kind: 'component',
          component: toComponentSummary(target.row),
          ...shared
        };
  }

  /**
   * The document's own tally, which the landing page draws and the composed
   * card draws beside it. Two tables, because a component's stars are a table
   * of their own.
   */
  private stars(target: ShareTarget): Promise<number> {
    return target.kind === 'project'
      ? starTally(this.db, projectStars, projectStars.projectId, target.row.id)
      : starTally(
          this.db,
          componentStars,
          componentStars.componentId,
          target.row.id
        );
  }

  private async author(userId: string): Promise<ReturnType<typeof toAuthor>> {
    const [user] = await this.db
      .select({
        id: users.id,
        username: users.username,
        avatarId: users.avatarId
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // The owner column is `ON DELETE CASCADE`, so a document without one is a
    // defect rather than a case to handle.
    if (!user) {
      throw new Error(`Document owner ${userId} does not exist.`);
    }
    return toAuthor(user as Pick<UserRow, 'id' | 'username' | 'avatarId'>);
  }
}
