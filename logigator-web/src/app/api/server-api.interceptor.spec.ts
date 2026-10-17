import { HttpClient } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { REQUEST, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureTestBed } from '../../testing/configure-test-bed';
import { API_ORIGIN } from './server-api.interceptor';

const API = 'http://api:3000';

/** The request Caddy hands the render: HTTPS outside, plain HTTP on this hop. */
function visitorRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://logigator.test/en/', {
    headers: {
      cookie: 'lg_sid=abc',
      'x-forwarded-for': '203.0.113.7',
      'x-forwarded-proto': 'https',
      ...headers
    }
  });
}

function arrange(incoming: Request | null, responseInit: ResponseInit = {}) {
  configureTestBed([
    { provide: API_ORIGIN, useValue: API },
    { provide: REQUEST, useValue: incoming },
    { provide: RESPONSE_INIT, useValue: responseInit }
  ]);
  return {
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController)
  };
}

describe('apiOriginInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  afterEach(() => {
    backend.verify();
  });

  describe('on the server', () => {
    beforeEach(() => {
      ({ http, backend } = arrange(visitorRequest()));
    });

    it('moves a relative path onto the API origin', () => {
      http.get('/api/user').subscribe();

      backend.expectOne(`${API}/api/user`).flush({});
    });

    it("carries the visitor's scheme, so the API's Secure cookies survive", () => {
      // The hop is plain HTTP while the API's session cookie is `Secure`, and
      // `@fastify/session` writes no cookie at all on a connection it reads as
      // insecure — the hint cookie would come back alone.
      http.get('/api/user').subscribe();

      const sent = backend.expectOne(`${API}/api/user`);
      expect(sent.request.headers.get('x-forwarded-proto')).toBe('https');
      sent.flush({});
    });

    it("carries the visitor's address, so rate limits are not shared", () => {
      // Without it every render counts against one bucket: this container's.
      http.get('/api/user').subscribe();

      const sent = backend.expectOne(`${API}/api/user`);
      expect(sent.request.headers.get('x-forwarded-for')).toBe('203.0.113.7');
      sent.flush({});
    });

    it('forwards the session cookie', () => {
      http.get('/api/user').subscribe();

      const sent = backend.expectOne(`${API}/api/user`);
      expect(sent.request.headers.get('cookie')).toBe('lg_sid=abc');
      sent.flush({});
    });

    it('leaves an absolute URL alone', () => {
      http.get('https://example.test/thing').subscribe();

      backend.expectOne('https://example.test/thing').flush({});
    });
  });

  it('derives the scheme from the resolved URL, not the header', () => {
    // `NG_TRUST_PROXY_HEADERS` decides whether Angular believed the header when
    // it built the request URL. Reading the header directly would forward a
    // scheme the deployment was told not to trust.
    ({ http, backend } = arrange(
      new Request('http://logigator.test/en/', {
        headers: { 'x-forwarded-proto': 'https' }
      })
    ));

    http.get('/api/user').subscribe();

    const sent = backend.expectOne(`${API}/api/user`);
    expect(sent.request.headers.get('x-forwarded-proto')).toBe('http');
    sent.flush({});
  });

  it("hands the API's Set-Cookie to the visitor", () => {
    const responseInit: ResponseInit = {};
    ({ http, backend } = arrange(visitorRequest(), responseInit));

    http.get('/api/user').subscribe();

    backend.expectOne(`${API}/api/user`).flush(
      {},
      {
        headers: { 'set-cookie': 'lg_sid=next; Path=/; HttpOnly' }
      }
    );

    const headers = responseInit.headers as Headers;
    expect(headers.get('set-cookie')).toBe('lg_sid=next; Path=/; HttpOnly');
  });

  it('is a pass-through in the browser, where no origin is provided', () => {
    configureTestBed([{ provide: API_ORIGIN, useValue: null }]);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);

    http.get('/api/user').subscribe();

    const sent = backend.expectOne('/api/user');
    expect(sent.request.headers.has('x-forwarded-proto')).toBe(false);
    sent.flush({});
  });
});
