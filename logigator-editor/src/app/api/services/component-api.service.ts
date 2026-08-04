import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import type { Page } from '../models/shared';
import type {
  ComponentDetail,
  ComponentSummary,
  CreateComponentRequest,
  SaveComponentRequest,
  UpdateComponentRequest
} from '../models/component';

@Injectable({ providedIn: 'root' })
export class ComponentApiService {
  private readonly api = inject(ApiBaseService);
  private readonly path = '/api/component';

  /**
   * GET /api/component
   * When called with no params, returns ALL components (not paginated).
   * When called with page/size, returns a paginated result.
   */
  list(): Observable<ComponentSummary[]>;
  list(
    page: number,
    size: number,
    search?: string
  ): Observable<Page<ComponentSummary>>;
  list(
    page?: number,
    size?: number,
    search?: string
  ): Observable<ComponentSummary[] | Page<ComponentSummary>> {
    if (page !== undefined || size !== undefined || search !== undefined) {
      return this.api.get<Page<ComponentSummary>>(this.path, {
        page,
        size,
        search
      });
    }
    return this.api.get<ComponentSummary[]>(this.path);
  }

  /** POST /api/component — create a new component. */
  create(body: CreateComponentRequest): Observable<ComponentSummary> {
    return this.api.post<ComponentSummary>(this.path, body);
  }

  /** GET /api/component/:componentId — open a component (includes elements + dependencies). */
  open(componentId: string): Observable<ComponentDetail> {
    return this.api.get<ComponentDetail>(`${this.path}/${componentId}`);
  }

  /** PUT /api/component/:componentId — save circuit content. */
  save(
    componentId: string,
    body: SaveComponentRequest
  ): Observable<ComponentSummary> {
    return this.api.put<ComponentSummary>(`${this.path}/${componentId}`, body);
  }

  /** PATCH /api/component/:componentId — update metadata. */
  update(
    componentId: string,
    body: UpdateComponentRequest
  ): Observable<ComponentSummary> {
    return this.api.patch<ComponentSummary>(
      `${this.path}/${componentId}`,
      body
    );
  }

  /** DELETE /api/component/:componentId */
  delete(componentId: string): Observable<ComponentSummary> {
    return this.api.delete<ComponentSummary>(`${this.path}/${componentId}`);
  }

  /** POST /api/component/:componentId/preview — upload dark + light preview PNGs. */
  updatePreviews(
    componentId: string,
    formData: FormData
  ): Observable<ComponentSummary> {
    return this.api.postFormData<ComponentSummary>(
      `${this.path}/${componentId}/preview`,
      formData
    );
  }

  /** GET /api/component/clone/:link — clone a shared component. */
  cloneFromShare(link: string): Observable<ComponentSummary> {
    return this.api.get<ComponentSummary>(`${this.path}/clone/${link}`);
  }
}
