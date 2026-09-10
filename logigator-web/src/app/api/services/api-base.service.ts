import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams
} from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import type { z } from 'zod';
import { environment } from '../../../environments/environment';
import { InvalidResponseError } from '@logigator/contract';
import { toApiRequestError } from '../api-error';

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
 * `HttpClient` for the Logigator API: prepends `environment.apiUrl`, validates
 * every response against its `@logigator/contract` schema and turns a failure
 * into an {@link ApiRequestError} carrying the API's own code.
 *
 * The paths it builds are origin-relative. A server render cannot fetch one, so
 * `serverApiInterceptor` rewrites them onto the API's own origin and carries
 * the caller's session cookie across — which is what lets a page render
 * personalized in its first byte.
 *
 * Responses are not enveloped — a body *is* the resource — so validating here
 * keeps a shape mismatch a named boundary failure rather than an `undefined`
 * surfacing deep inside the consumer. The schemas are loose, so an API that
 * grows a field does not break a client holding an older contract copy.
 */
@Injectable({ providedIn: 'root' })
export class ApiBaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  public get<T>(
    path: string,
    schema: z.ZodType<T>,
    params?: QueryParams
  ): Observable<T> {
    return this.validate(
      path,
      schema,
      this.http.get<unknown>(this.url(path), {
        params: params ? toHttpParams(params) : undefined
      })
    );
  }

  public post<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Observable<T> {
    return this.validate(
      path,
      schema,
      this.http.post<unknown>(this.url(path), body ?? {})
    );
  }

  public patch<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Observable<T> {
    return this.validate(
      path,
      schema,
      this.http.patch<unknown>(this.url(path), body ?? {})
    );
  }

  public put<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Observable<T> {
    return this.validate(
      path,
      schema,
      this.http.put<unknown>(this.url(path), body ?? {})
    );
  }

  /**
   * `DELETE` with a body to validate. Removing a star answers the state it
   * produced rather than `204`, so the caller needs the count without a
   * second read.
   */
  public delete<T>(path: string, schema: z.ZodType<T>): Observable<T> {
    return this.validate(
      path,
      schema,
      this.http.delete<unknown>(this.url(path))
    );
  }

  /** For the routes that answer `204`: no body, so no schema. */
  public postEmpty(path: string, body?: unknown): Observable<void> {
    return this.discard(this.http.post<unknown>(this.url(path), body ?? {}));
  }

  public deleteEmpty(path: string): Observable<void> {
    return this.discard(this.http.delete<unknown>(this.url(path)));
  }

  /**
   * `DELETE` carrying a body and answering `204`. Deleting an account takes the
   * password that proves the intent, and there is no other verb for it: the
   * resource being removed is the caller's own account.
   */
  public deleteWithBody(path: string, body: unknown): Observable<void> {
    return this.discard(this.http.delete<unknown>(this.url(path), { body }));
  }

  private validate<T>(
    path: string,
    schema: z.ZodType<T>,
    request: Observable<unknown>
  ): Observable<T> {
    return request.pipe(
      this.mapError(),
      map((body) => {
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new InvalidResponseError(path, parsed.error.message);
        }
        return parsed.data;
      })
    );
  }

  private discard(request: Observable<unknown>): Observable<void> {
    return request.pipe(
      this.mapError(),
      map(() => undefined)
    );
  }

  private mapError() {
    return catchError((err: unknown) =>
      throwError(() =>
        err instanceof HttpErrorResponse ? toApiRequestError(err) : err
      )
    );
  }

  // Exactly one slash between baseUrl and path.
  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  }
}
