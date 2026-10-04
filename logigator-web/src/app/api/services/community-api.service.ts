import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  communityComponentDetailSchema,
  communityComponentPageSchema,
  communityProjectDetailSchema,
  communityProjectPageSchema,
  publicProfileSchema,
  stargazerPageSchema,
  starResponseSchema,
  type CommunityComponentDetail,
  type CommunityComponentPage,
  type CommunityProjectDetail,
  type CommunityProjectPage,
  type CommunityQuery,
  type PublicProfile,
  type StargazerPage,
  type StarResponse
} from '@logigator/contract';
import { ApiBaseService, type QueryParams } from './api-base.service';

/**
 * How a listing is ranked. Taken off the contract rather than written out, so a
 * fourth ranking cannot exist here without existing there.
 */
export type CommunityOrder = CommunityQuery['orderBy'];

export interface CommunityListQuery {
  page?: number;
  size?: number;
  search?: string;
  orderBy?: CommunityOrder;
}

/** Which of the two tables a route addresses; the shapes are symmetric. */
export type CommunityKind = 'projects' | 'components';

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

  /** GET /api/community/users/:id/components */
  public userComponents(
    userId: string,
    query: Omit<CommunityListQuery, 'orderBy'> = {}
  ): Observable<CommunityComponentPage> {
    return this.api.get(
      `/api/community/users/${userId}/components`,
      communityComponentPageSchema,
      toParams(query)
    );
  }

  /**
   * GET /api/community/users/:id/starred/projects. Public, and independent of
   * the caller-scoped `starred/*` routes: the rows are that member's stars,
   * while `starred` on each row still answers for whoever is reading.
   */
  public userStarredProjects(
    userId: string,
    query: Omit<CommunityListQuery, 'orderBy'> = {}
  ): Observable<CommunityProjectPage> {
    return this.api.get(
      `/api/community/users/${userId}/starred/projects`,
      communityProjectPageSchema,
      toParams(query)
    );
  }

  /** GET /api/community/users/:id/starred/components */
  public userStarredComponents(
    userId: string,
    query: Omit<CommunityListQuery, 'orderBy'> = {}
  ): Observable<CommunityComponentPage> {
    return this.api.get(
      `/api/community/users/${userId}/starred/components`,
      communityComponentPageSchema,
      toParams(query)
    );
  }

  /** GET /api/community/projects/:link — a published project's own page. */
  public projectDetail(link: string): Observable<CommunityProjectDetail> {
    return this.api.get(
      `/api/community/projects/${link}`,
      communityProjectDetailSchema
    );
  }

  /** GET /api/community/components/:link */
  public componentDetail(link: string): Observable<CommunityComponentDetail> {
    return this.api.get(
      `/api/community/components/${link}`,
      communityComponentDetailSchema
    );
  }

  /** GET /api/community/{projects,components}/:link/stargazers */
  public stargazers(
    kind: CommunityKind,
    link: string,
    query: Omit<CommunityListQuery, 'orderBy' | 'search'> = {}
  ): Observable<StargazerPage> {
    return this.api.get(
      `/api/community/${kind}/${link}/stargazers`,
      stargazerPageSchema,
      toParams(query)
    );
  }

  /** GET /api/community/users/:id */
  public profile(userId: string): Observable<PublicProfile> {
    return this.api.get(`/api/community/users/${userId}`, publicProfileSchema);
  }

  /**
   * `PUT`/`DELETE` rather than a toggle: each states the state it wants, so a
   * double click or a retry lands where the reader meant instead of undoing
   * itself. The response carries the count it produced, so the page needs no
   * second read to show it.
   */
  public setStar(
    kind: CommunityKind,
    link: string,
    starred: boolean
  ): Observable<StarResponse> {
    const path = `/api/community/${kind}/${link}/star`;
    return starred
      ? this.api.put(path, starResponseSchema)
      : this.api.delete(path, starResponseSchema);
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
