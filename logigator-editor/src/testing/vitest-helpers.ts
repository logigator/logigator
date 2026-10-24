import { vi } from 'vitest';
import type {
  HttpTestingController,
  TestRequest
} from '@angular/common/http/testing';
import { gunzipJson } from '@logigator/core';

/**
 * Asymmetric matcher succeeding when the actual array holds exactly the
 * expected items by identity — any order, no extras.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function arrayWithExactContents<T>(expected: T[]): any {
  return {
    asymmetricMatch(actual: unknown): boolean {
      if (!Array.isArray(actual)) return false;
      if (actual.length !== expected.length) return false;
      const remaining = [...actual];
      for (const item of expected) {
        const idx = remaining.indexOf(item);
        if (idx === -1) return false;
        remaining.splice(idx, 1);
      }
      return remaining.length === 0;
    }
  };
}

/**
 * A request the client gzips. Two things differ from a plain one: it is issued
 * a microtask late, compression being async, and its body is the compressed
 * bytes rather than the object — so a spec waits for it and inflates.
 */
export function expectGzipped(
  httpMock: HttpTestingController,
  url: string
): Promise<TestRequest> {
  return vi.waitFor(() => httpMock.expectOne(url));
}

/** The JSON body behind {@link expectGzipped}'s bytes. */
export async function gzippedBody(
  request: TestRequest
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const bytes = new Uint8Array(request.request.body as ArrayBuffer);
  return JSON.parse(await gunzipJson(bytes));
}
