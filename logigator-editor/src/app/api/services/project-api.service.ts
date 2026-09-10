import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  projectPageSchema,
  projectResponseSchema,
  projectSummarySchema,
  type CreateProjectRequest,
  type ProjectPage,
  type ProjectResponse,
  type ProjectSummary,
  type SaveCircuitRequest,
  type UpdateProjectRequest
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

/** The caller's own projects: `/api/projects`. */
@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly api = inject(ApiBaseService);
  private readonly path = '/api/projects';

  /** GET /api/projects — one page of the user's projects. */
  list(page: number, size: number, search?: string): Observable<ProjectPage> {
    return this.api.get(this.path, projectPageSchema, { page, size, search });
  }

  /**
   * POST /api/projects — create a project, optionally with its circuit already
   * in it, which makes the upload one round trip.
   */
  create(body: CreateProjectRequest): Observable<ProjectSummary> {
    return this.api.post(this.path, projectSummarySchema, body);
  }

  /** GET /api/projects/:id — the document, its dependencies and its lineage. */
  open(projectId: string): Observable<ProjectResponse> {
    return this.api.get(`${this.path}/${projectId}`, projectResponseSchema);
  }

  /** PUT /api/projects/:id — replace the circuit, against the version read. */
  save(
    projectId: string,
    body: SaveCircuitRequest
  ): Observable<ProjectSummary> {
    return this.api.put(
      `${this.path}/${projectId}`,
      projectSummarySchema,
      body
    );
  }

  /** PATCH /api/projects/:id — name, description, visibility, share link. */
  update(
    projectId: string,
    body: UpdateProjectRequest
  ): Observable<ProjectSummary> {
    return this.api.patch(
      `${this.path}/${projectId}`,
      projectSummarySchema,
      body
    );
  }

  /** DELETE /api/projects/:id */
  delete(projectId: string): Observable<void> {
    return this.api.deleteEmpty(`${this.path}/${projectId}`);
  }

  /**
   * POST /api/projects/:id/preview — both theme renders in one request, each
   * part named for the theme it shows.
   */
  setPreview(
    projectId: string,
    formData: FormData
  ): Observable<ProjectSummary> {
    return this.api.postFormData(
      `${this.path}/${projectId}/preview`,
      projectSummarySchema,
      formData
    );
  }
}
