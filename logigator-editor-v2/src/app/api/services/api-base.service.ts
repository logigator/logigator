import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiResponse } from '../models/shared';
import { environment } from '../../../environments/environment';

/** Plain-object form of HTTP query parameters. */
export type QueryParams = Record<string, string | number | boolean | undefined>;

function toHttpParams(params: QueryParams): HttpParams {
  let httpParams = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      httpParams = httpParams.set(key, String(value));
    }
  }
  return httpParams;
}

/**
 * Thin wrapper around Angular's HttpClient for the Logigator API.
 *
 * - Prepends the configured base URL from `environment.api`
 * - Unwraps the backend's `{ status, data }` envelope automatically
 * - Converts plain-object query params to `HttpParams`
 */
@Injectable({ providedIn: 'root' })
export class ApiBaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** GET request — unwraps `ApiResponse<T>` to just `T`. */
  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<
        ApiResponse<T>
      >(this.url(path), { params: params ? toHttpParams(params) : undefined })
      .pipe(map((r) => r.data));
  }

  /** POST request. */
  post<T>(path: string, body?: unknown, params?: QueryParams): Observable<T> {
    return this.http
      .post<
        ApiResponse<T>
      >(this.url(path), body ?? {}, { params: params ? toHttpParams(params) : undefined })
      .pipe(map((r) => r.data));
  }

  /** PUT request. */
  put<T>(path: string, body?: unknown, params?: QueryParams): Observable<T> {
    return this.http
      .put<
        ApiResponse<T>
      >(this.url(path), body ?? {}, { params: params ? toHttpParams(params) : undefined })
      .pipe(map((r) => r.data));
  }

  /** PATCH request. */
  patch<T>(path: string, body?: unknown, params?: QueryParams): Observable<T> {
    return this.http
      .patch<
        ApiResponse<T>
      >(this.url(path), body ?? {}, { params: params ? toHttpParams(params) : undefined })
      .pipe(map((r) => r.data));
  }

  /** DELETE request. */
  delete<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .delete<
        ApiResponse<T>
      >(this.url(path), { params: params ? toHttpParams(params) : undefined })
      .pipe(map((r) => r.data));
  }

  /** POST with `FormData` body (for file uploads). */
  postFormData<T>(path: string, formData: FormData): Observable<T> {
    return this.http
      .post<ApiResponse<T>>(this.url(path), formData)
      .pipe(map((r) => r.data));
  }

  // Merge baseUrl and path, ensuring there's exactly one slash between them
  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}
