import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import type { Page } from '../models/shared';
import type { ProjectElement } from '../models/project-element';
import type {
  ProjectSummary,
  ProjectDetail,
  CreateProjectRequest,
  SaveProjectRequest,
  UpdateProjectRequest
} from '../models/project';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly api = inject(ApiBaseService);
  private readonly path = '/api/project';

  /** GET /api/project — paginated list of the user's projects. */
  list(
    page: number,
    size: number,
    search?: string
  ): Observable<Page<ProjectSummary>> {
    return this.api.get<Page<ProjectSummary>>(this.path, {
      page,
      size,
      search
    });
  }

  /** POST /api/project — create a new project. */
  create(body: CreateProjectRequest): Observable<ProjectSummary> {
    return this.api.post<ProjectSummary>(this.path, body);
  }

  /** GET /api/project/:projectId — open a project (includes elements + dependencies). */
  open(projectId: string): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(`${this.path}/${projectId}`);
  }

  /** PUT /api/project/:projectId — save circuit content. */
  save(
    projectId: string,
    body: SaveProjectRequest
  ): Observable<ProjectSummary> {
    return this.api.put<ProjectSummary>(`${this.path}/${projectId}`, body);
  }

  /** PATCH /api/project/:projectId — update metadata (name, description, visibility, share link). */
  update(
    projectId: string,
    body: UpdateProjectRequest
  ): Observable<ProjectSummary> {
    return this.api.patch<ProjectSummary>(`${this.path}/${projectId}`, body);
  }

  /** DELETE /api/project/:projectId */
  delete(projectId: string): Observable<ProjectSummary> {
    return this.api.delete<ProjectSummary>(`${this.path}/${projectId}`);
  }

  /** POST /api/project/:projectId/preview — upload dark + light preview PNGs. */
  updatePreviews(
    projectId: string,
    formData: FormData
  ): Observable<ProjectSummary> {
    return this.api.postFormData<ProjectSummary>(
      `${this.path}/${projectId}/preview`,
      formData
    );
  }

  /** GET /api/project/clone/:link — clone a shared project. */
  cloneFromShare(link: string): Observable<ProjectSummary> {
    return this.api.get<ProjectSummary>(`${this.path}/clone/${link}`);
  }

  // ---- Convenience wrappers for callers that only need elements ----

  /** Open a project and return only its elements array. */
  openElements(projectId: string): Observable<ProjectElement[]> {
    return this.open(projectId).pipe(map((detail) => detail.elements));
  }
}
