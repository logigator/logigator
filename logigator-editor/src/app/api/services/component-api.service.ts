import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  componentPageSchema,
  componentResponseSchema,
  componentSummarySchema,
  type ComponentPage,
  type ComponentResponse,
  type ComponentSummary,
  type CreateComponentRequest,
  type SaveCircuitRequest,
  type UpdateComponentRequest
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

/** The caller's own library components: `/api/components`. */
@Injectable({ providedIn: 'root' })
export class ComponentApiService {
  private readonly api = inject(ApiBaseService);
  private readonly path = '/api/components';

  /**
   * GET /api/components — one page of the user's library. Always paginated, so
   * the startup preload walks the pages rather than asking for everything.
   */
  list(page: number, size: number, search?: string): Observable<ComponentPage> {
    return this.api.get(this.path, componentPageSchema, { page, size, search });
  }

  /**
   * POST /api/components — create a component, optionally with its circuit,
   * which is also how a browser master is promoted. Gzipped, like every write
   * that can carry a document.
   */
  create(body: CreateComponentRequest): Observable<ComponentSummary> {
    return this.api.postCompressed(this.path, componentSummarySchema, body);
  }

  /** GET /api/components/:id — the document, its dependencies and its lineage. */
  open(componentId: string): Observable<ComponentResponse> {
    return this.api.get(`${this.path}/${componentId}`, componentResponseSchema);
  }

  /**
   * PUT /api/components/:id — replace the circuit, against the version read.
   * The port surface is derived server-side, so nothing here declares it.
   * Gzipped, as the project save is.
   */
  save(
    componentId: string,
    body: SaveCircuitRequest
  ): Observable<ComponentSummary> {
    return this.api.putCompressed(
      `${this.path}/${componentId}`,
      componentSummarySchema,
      body
    );
  }

  /** PATCH /api/components/:id — name, symbol, description, visibility, link. */
  update(
    componentId: string,
    body: UpdateComponentRequest
  ): Observable<ComponentSummary> {
    return this.api.patch(
      `${this.path}/${componentId}`,
      componentSummarySchema,
      body
    );
  }

  /** DELETE /api/components/:id */
  delete(componentId: string): Observable<void> {
    return this.api.deleteEmpty(`${this.path}/${componentId}`);
  }

  /**
   * POST /api/components/:id/preview — both theme renders in one request, each
   * part named for the theme it shows.
   */
  setPreview(
    componentId: string,
    formData: FormData
  ): Observable<ComponentSummary> {
    return this.api.postFormData(
      `${this.path}/${componentId}/preview`,
      componentSummarySchema,
      formData
    );
  }

  /** DELETE /api/components/:id/preview — back to the placeholder. */
  clearPreview(componentId: string): Observable<void> {
    return this.api.deleteEmpty(`${this.path}/${componentId}/preview`);
  }
}
