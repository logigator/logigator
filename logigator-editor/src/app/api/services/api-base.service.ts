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
 * Responses are not enveloped — a body *is* the resource — so validating here
 * keeps a shape mismatch a named boundary failure rather than an `undefined`
 * surfacing deep inside the decode. The schemas are loose, so an API that grows
 * a field does not break a client holding an older contract copy.
 */
@Injectable({ providedIn: 'root' })
export class ApiBaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  get<T>(
    path: string,
    schema: z.ZodType<T>,
    params?: QueryParams
  ): Observable<T> {
    return this._validate(
      path,
      schema,
      this.http.get<unknown>(this.url(path), this._options(params))
    );
  }

  post<T>(path: string, schema: z.ZodType<T>, body?: unknown): Observable<T> {
    return this._validate(
      path,
      schema,
      this.http.post<unknown>(this.url(path), body ?? {})
    );
  }

  put<T>(path: string, schema: z.ZodType<T>, body?: unknown): Observable<T> {
    return this._validate(
      path,
      schema,
      this.http.put<unknown>(this.url(path), body ?? {})
    );
  }

  patch<T>(path: string, schema: z.ZodType<T>, body?: unknown): Observable<T> {
    return this._validate(
      path,
      schema,
      this.http.patch<unknown>(this.url(path), body ?? {})
    );
  }

  /** POST with a `FormData` body, for the multipart upload routes. */
  postFormData<T>(
    path: string,
    schema: z.ZodType<T>,
    formData: FormData
  ): Observable<T> {
    return this._validate(
      path,
      schema,
      this.http.post<unknown>(this.url(path), formData)
    );
  }

  /** For the routes that answer `204`: no body, so no schema. */
  postEmpty(path: string, body?: unknown): Observable<void> {
    return this._discard(this.http.post<unknown>(this.url(path), body ?? {}));
  }

  deleteEmpty(path: string): Observable<void> {
    return this._discard(this.http.delete<unknown>(this.url(path)));
  }

  private _options(params?: QueryParams) {
    return { params: params ? toHttpParams(params) : undefined };
  }

  private _validate<T>(
    path: string,
    schema: z.ZodType<T>,
    request: Observable<unknown>
  ): Observable<T> {
    return request.pipe(
      this._mapError(),
      map((body) => {
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          throw new InvalidResponseError(path, parsed.error.message);
        }
        return parsed.data;
      })
    );
  }

  private _discard(request: Observable<unknown>): Observable<void> {
    return request.pipe(
      this._mapError(),
      map(() => undefined)
    );
  }

  private _mapError() {
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
