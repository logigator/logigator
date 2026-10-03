import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import * as z from 'zod';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { expectGzipped, gzippedBody } from '../../../testing/vitest-helpers';
import { ApiBaseService } from './api-base.service';

/**
 * The compressed verbs. What matters is that the bytes on the wire are the
 * body the caller handed in, gzipped and declared as such — the API inflates
 * by the header alone, so a mismatch between the two is a 400 nothing in the
 * editor could act on.
 */
describe('ApiBaseService compressed writes', () => {
  let api: ApiBaseService;
  let http: HttpTestingController;

  const schema = z.object({ id: z.string() }).loose();

  beforeEach(() => {
    configureTestBed();
    api = TestBed.inject(ApiBaseService);
    http = TestBed.inject(HttpTestingController);
  });

  it('puts the body gzipped, as bytes that inflate back to it', async () => {
    const body = {
      version: 3,
      document: { name: 'Board', components: [{ t: 0, p: [1, 2] }] }
    };

    const response = firstValueFrom(
      api.putCompressed('/api/projects/abc', schema, body)
    );
    const request = await expectGzipped(http, '/api/projects/abc');

    expect(request.request.headers.get('Content-Encoding')).toBe('gzip');
    // The media type describes the *decoded* body: the encoding is the other
    // header's business.
    expect(request.request.headers.get('Content-Type')).toBe(
      'application/json'
    );

    // Inflate rather than assert a byte count: what has to hold is that the
    // API reads back exactly what was handed in.
    expect(request.request.body).toBeInstanceOf(ArrayBuffer);
    expect(await gzippedBody(request)).toEqual(body);

    request.flush({ id: 'abc' });
    expect(await response).toEqual({ id: 'abc' });
  });

  it('posts the same way, and still validates the response', async () => {
    const response = firstValueFrom(
      api.postCompressed('/api/components', schema, { name: 'Adder' })
    );
    const request = await expectGzipped(http, '/api/components');

    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Content-Encoding')).toBe('gzip');

    // A response that does not match the schema is a boundary failure, exactly
    // as it is for the plain verbs — compressing the request changes nothing
    // about how the answer is read.
    request.flush({ id: 42 });
    await expect(response).rejects.toThrow();
  });

  it('leaves a multipart upload uncompressed', async () => {
    const form = new FormData();
    form.append('light', new Blob([new Uint8Array([1, 2, 3])]), 'light.webp');

    const response = firstValueFrom(
      api.postFormData('/api/projects/abc/preview', schema, form)
    );
    const request = http.expectOne('/api/projects/abc/preview');

    // Already-compressed bytes the boundary parser walks: gzipping them would
    // spend CPU at both ends to make the payload bigger.
    expect(request.request.headers.get('Content-Encoding')).toBeNull();
    expect(request.request.body).toBe(form);

    request.flush({ id: 'abc' });
    expect(await response).toEqual({ id: 'abc' });
  });

  it('leaves the plain verbs sending JSON objects', async () => {
    const body = { name: 'Renamed' };
    const response = firstValueFrom(
      api.patch('/api/projects/abc', schema, body)
    );
    const request = http.expectOne('/api/projects/abc');

    expect(request.request.headers.get('Content-Encoding')).toBeNull();
    expect(request.request.body).toBe(body);

    request.flush({ id: 'abc' });
    expect(await response).toEqual({ id: 'abc' });
  });
});
