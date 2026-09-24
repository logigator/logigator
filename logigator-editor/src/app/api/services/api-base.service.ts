import { inject, Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams
} from '@angular/common/http';
import { catchError, from, map, Observable, switchMap, throwError } from 'rxjs';
import type { z } from 'zod';
import { environment } from '../../../environments/environment';
import { InvalidResponseError } from '@logigator/contract';
import { gzipJson } from '@logigator/core';
import { toApiRequestError } from '../api-error';

export type QueryParams = Record<string, string | number | boolean | undefined>;

/**
 * What a gzipped write says about its body: the media type of the *decoded*
 * body, and the encoding applied on top of it. No `LGIX` framing — that
 * container is for bytes at rest; a proxy told `gzip` must find gzip.
 */
const COMPRESSED_HEADERS = {
  'Content-Type': 'application/json',
  'Content-Encoding': 'gzip'
};

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

  /**
   * PUT with a gzipped JSON body, for the document writes. A browser never
   * compresses a request body of its own — response encoding is negotiated,
   * a request has no such handshake — so the client compresses and declares
   * it, and the API inflates it in `preParsing`.
   *
   * Every document write takes this path, with no size threshold: a small
   * board still shrinks, and a boundary would be one more branch that no test
   * naturally sits on. The API accepts both forms, so this is a client rule.
   */
  putCompressed<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Observable<T> {
    return this._compressed('PUT', path, schema, body);
  }

  /** POST with a gzipped JSON body. See {@link putCompressed}. */
  postCompressed<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown
  ): Observable<T> {
    return this._compressed('POST', path, schema, body);
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

  /**
   * Compression is async, so the request is a `switchMap` over it and the
   * method still answers an `Observable<T>` — every call site keeps its shape.
   * The body goes out as the `ArrayBuffer` behind the bytes: `HttpRequest`
   * passes an `ArrayBuffer` through untouched, while a `TypedArray` falls to
   * its object branch and would be `JSON.stringify`d into a digit map.
   */
  private _compressed<T>(
    method: 'POST' | 'PUT',
    path: string,
    schema: z.ZodType<T>,
    body: unknown
  ): Observable<T> {
    return this._validate(
      path,
      schema,
      from(gzipJson(JSON.stringify(body ?? {}))).pipe(
        switchMap((bytes) =>
          this.http.request<unknown>(method, this.url(path), {
            body: bytes.buffer,
            headers: COMPRESSED_HEADERS
          })
        )
      )
    );
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
