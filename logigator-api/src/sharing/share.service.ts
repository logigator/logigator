import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { ShareResponse } from '@logigator/contract';
import { ApiException } from '../common/api-exception';
import { DB, type Database } from '../database/database.module';
import {
  components,
  projects,
  users,
  type ComponentRow,
  type ProjectRow,
  type UserRow
} from '../database/schema';
import { CircuitDocumentService } from '../documents/circuit-document.service';
import { findByLink, forkLineage } from '../documents/circuit-queries';
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

/** What a share link turned out to point at. */
export type ShareTarget =
  | { kind: 'project'; row: ProjectRow }
  | { kind: 'component'; row: ComponentRow };

/**
 * Reading a document through its share link. The link is a **capability**:
 * holding the URL is the grant, so this needs no session and ignores `public`,
 * and revoking is minting a new token rather than tracking who was told.
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

  /** Whichever kind of document holds this token. */
  async resolve(link: string): Promise<ShareTarget> {
    const project = await findByLink(this.db, projects, link);
    if (project) return { kind: 'project', row: project };

    const component = await findByLink(this.db, components, link);
    if (component) return { kind: 'component', row: component };

    throw new ApiException(
      HttpStatus.NOT_FOUND,
      'not_found',
      'No such share link.'
    );
  }

  async read(link: string): Promise<ShareResponse> {
    const target = await this.resolve(link);
    const table = target.kind === 'project' ? projects : components;

    const [author, dependencies, lineage] = await Promise.all([
      this.author(target.row.userId),
      this.dependencies.summaries(
        target.kind === 'project' ? PROJECT_EDGES : COMPONENT_EDGES,
        target.row.id
      ),
      forkLineage(this.db, table, target.row)
    ]);

    const shared = {
      document: this.documents.read(target.row.document, target.row.id),
      dependencies,
      attribution: toAttribution(lineage),
      author
    };

    return target.kind === 'project'
      ? { kind: 'project', project: toProjectSummary(target.row), ...shared }
      : {
          kind: 'component',
          component: toComponentSummary(target.row),
          ...shared
        };
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
