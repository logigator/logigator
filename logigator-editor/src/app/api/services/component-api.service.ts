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
   * GET /api/components — one page of the user's library.
   *
   * Paginated always: the caller picks the page, never how much work the server
   * does, so the startup preload walks the pages rather than asking for all of
   * them at once.
   */
  list(page: number, size: number, search?: string): Observable<ComponentPage> {
    return this.api.get(this.path, componentPageSchema, { page, size, search });
  }

  /** POST /api/components — create a component, optionally with its circuit. */
  create(body: CreateComponentRequest): Observable<ComponentSummary> {
    return this.api.post(this.path, componentSummarySchema, body);
  }

  /** GET /api/components/:id — the document, its dependencies and its lineage. */
  open(componentId: string): Observable<ComponentResponse> {
    return this.api.get(`${this.path}/${componentId}`, componentResponseSchema);
  }

  /**
   * PUT /api/components/:id — replace the circuit, against the version read.
   * The port surface is derived server-side from the document, so nothing here
   * declares it.
   */
  save(
    componentId: string,
    body: SaveCircuitRequest
  ): Observable<ComponentSummary> {
    return this.api.put(
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
}
