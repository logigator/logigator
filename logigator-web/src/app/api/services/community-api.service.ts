import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  communityComponentPageSchema,
  communityProjectPageSchema,
  type CommunityComponentPage,
  type CommunityProjectPage
} from '@logigator/contract';
import { ApiBaseService, type QueryParams } from './api-base.service';

/** How a listing is ranked; the API defaults to `stars`. */
export type CommunityOrder = 'stars' | 'latest';

export interface CommunityListQuery {
  page?: number;
  size?: number;
  search?: string;
  orderBy?: CommunityOrder;
}

/**
 * The public half of the API: published documents and who made them. Every one
 * of these reads works without a session; the star flags a signed-in caller
 * gets are the only difference.
 */
@Injectable({ providedIn: 'root' })
export class CommunityApiService {
  private readonly api = inject(ApiBaseService);

  /** GET /api/community/projects */
  public projects(
    query: CommunityListQuery = {}
  ): Observable<CommunityProjectPage> {
    return this.api.get(
      '/api/community/projects',
      communityProjectPageSchema,
      toParams(query)
    );
  }

  /** GET /api/community/components */
  public components(
    query: CommunityListQuery = {}
  ): Observable<CommunityComponentPage> {
    return this.api.get(
      '/api/community/components',
      communityComponentPageSchema,
      toParams(query)
    );
  }

  /**
   * GET /api/community/users/:id/projects. An account nobody has published
   * under answers an empty page rather than a 404.
   */
  public userProjects(
    userId: string,
    query: Omit<CommunityListQuery, 'orderBy'> = {}
  ): Observable<CommunityProjectPage> {
    return this.api.get(
      `/api/community/users/${userId}/projects`,
      communityProjectPageSchema,
      toParams(query)
    );
  }
}

/** Spelled out because an interface is not assignable to an index signature. */
function toParams(query: CommunityListQuery): QueryParams {
  return {
    page: query.page,
    size: query.size,
    search: query.search,
    orderBy: query.orderBy
  };
}
