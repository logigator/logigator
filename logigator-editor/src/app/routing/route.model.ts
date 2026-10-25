import { RouteKeys } from './route-keys.model';

export interface Route {
  readonly route: string;
  /**
   * `query` is the address's query string, which the pattern never sees. The
   * router leaves it in the address; a route that rewrites the address decides
   * whether to carry it over.
   */
  onActivation: (
    params: RouteKeys<never>,
    query: URLSearchParams
  ) => Promise<boolean> | boolean;
}
