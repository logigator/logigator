import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  componentPageSchema,
  componentSummarySchema,
  projectPageSchema,
  projectSummarySchema,
  type ComponentPage,
  type ComponentSummary,
  type ProjectPage,
  type ProjectSummary,
  type UpdateComponentRequest,
  type UpdateProjectRequest
} from '@logigator/contract';
import { ApiBaseService, type QueryParams } from './api-base.service';
import type { CommunityKind } from './community-api.service';

/** One page of the caller's own shelf, whichever of the two tables it is. */
export interface DocumentListQuery {
  page?: number;
  size?: number;
  search?: string;
}

/**
 * The caller's own documents. Every route here needs a session and describes
 * only what the caller owns — the same rows the community endpoints show the
 * world, read from the side that may change them.
 *
 * The site never writes a circuit: creating and saving are the editor's, which
 * has owned them since Phase 4. What is left is the metadata a shelf edits —
 * a name, a description, whether it is published, and the share token.
 */
@Injectable({ providedIn: 'root' })
export class DocumentsApiService {
  private readonly api = inject(ApiBaseService);

  /** GET /api/projects */
  public projects(query: DocumentListQuery = {}): Observable<ProjectPage> {
    return this.api.get('/api/projects', projectPageSchema, toParams(query));
  }

  /** GET /api/components */
  public components(query: DocumentListQuery = {}): Observable<ComponentPage> {
    return this.api.get(
      '/api/components',
      componentPageSchema,
      toParams(query)
    );
  }

  /**
   * PATCH /api/projects/:id. `regenerateLink` mints a new share token, which is
   * how a share is revoked: every URL under the old one stops resolving, the
   * document's own community page included.
   */
  public updateProject(
    id: string,
    body: UpdateProjectRequest
  ): Observable<ProjectSummary> {
    return this.api.patch(`/api/projects/${id}`, projectSummarySchema, body);
  }

  /** PATCH /api/components/:id */
  public updateComponent(
    id: string,
    body: UpdateComponentRequest
  ): Observable<ComponentSummary> {
    return this.api.patch(
      `/api/components/${id}`,
      componentSummarySchema,
      body
    );
  }

  /** DELETE /api/projects/:id — 204, and the row is gone with its document. */
  public deleteProject(id: string): Observable<void> {
    return this.api.deleteEmpty(`/api/projects/${id}`);
  }

  /** DELETE /api/components/:id */
  public deleteComponent(id: string): Observable<void> {
    return this.api.deleteEmpty(`/api/components/${id}`);
  }

  /** The kind as a path segment, for the two routes that take one. */
  public delete(kind: CommunityKind, id: string): Observable<void> {
    return kind === 'projects'
      ? this.deleteProject(id)
      : this.deleteComponent(id);
  }
}

/** Spelled out because an interface is not assignable to an index signature. */
function toParams(query: DocumentListQuery): QueryParams {
  return { page: query.page, size: query.size, search: query.search };
}
