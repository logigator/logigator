import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpHeaders,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { inject, InjectionToken, REQUEST, RESPONSE_INIT } from '@angular/core';
import { tap } from 'rxjs';

/**
 * Origin the server render reaches the API at. Provided only in the server
 * config: in the browser the API is a path on the same origin, and its absence
 * is what makes {@link apiOriginInterceptor} a pass-through there.
 */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN');

/**
 * Only these travel from the visitor's request to the API hop. `x-forwarded-for`
 * is the chain the proxy built, so the API's rate limiter counts the visitor
 * rather than this container, which every render would otherwise share — and it
 * arrives only where `NG_TRUST_PROXY_HEADERS` names it, an untrusted
 * `x-forwarded-*` being deleted before a render sees it. Passing it on decides
 * nothing: the API believes a forwarded header only where its own `TRUST_PROXY`
 * names the sender.
 */
const FORWARDED_HEADERS = [
  'cookie',
  'user-agent',
  'accept-language',
  'x-forwarded-for'
];

/**
 * Hands the API's cookies to the visitor. A server render is one hop inside a
 * request the browser made, so a cookie the API sets on it — a session slid
 * forward, an `isAuthenticated` hint cleared behind an expired one — reaches
 * the browser only by being copied onto the response the render produces.
 *
 * Angular reads `RESPONSE_INIT` after the render finishes, so appending while
 * it runs is enough, and each `Set-Cookie` stays a header of its own rather
 * than being folded into one value a client cannot split.
 */
function forwardSetCookie(from: HttpHeaders, to: ResponseInit | null): void {
  if (!to) {
    return;
  }
  const cookies = from.getAll('set-cookie');
  if (!cookies?.length) {
    return;
  }
  const headers =
    to.headers instanceof Headers ? to.headers : new Headers(to.headers);
  for (const cookie of cookies) {
    headers.append('set-cookie', cookie);
  }
  to.headers = headers;
}

/**
 * Makes the API reachable from a server render: an origin-relative path becomes
 * an absolute URL on the API's own origin, and the visitor's request headers
 * come along.
 *
 * The cookie is the point of it — with the session forwarded, a page renders
 * personalized in its first byte instead of flashing a signed-out shell. The
 * hop stays inside the deployment, so no credential leaves it, and what the API
 * sets on the way back travels on to the visitor.
 */
export const apiOriginInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const origin = inject(API_ORIGIN, { optional: true });
  if (!origin || /^[a-z][a-z0-9+.-]*:/i.test(request.url)) {
    return next(request);
  }

  const incoming = inject(REQUEST, { optional: true });
  // Injected here rather than where the response arrives: by then this
  // interceptor's injection context is gone.
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  let headers = request.headers;
  for (const name of FORWARDED_HEADERS) {
    const value = incoming?.headers.get(name);
    if (value && !headers.has(name)) {
      headers = headers.set(name, value);
    }
  }

  // This hop is plain HTTP inside the deployment while the API's cookies are
  // `Secure`, and `@fastify/session` writes no cookie at all on a connection it
  // reads as insecure — so without this the session it slides forward on a
  // render never reaches the browser, and only the hint cookie does.
  //
  // The scheme comes from the URL Angular resolved rather than from the header
  // itself: that URL is what `NG_TRUST_PROXY_HEADERS` has already been applied
  // to, so a deployment told to trust nothing forwards nothing.
  if (incoming && !headers.has('x-forwarded-proto')) {
    headers = headers.set(
      'x-forwarded-proto',
      new URL(incoming.url).protocol.replace(':', '')
    );
  }

  return next(
    request.clone({
      url: `${origin.replace(/\/+$/, '')}/${request.url.replace(/^\/+/, '')}`,
      headers
    })
  ).pipe(
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) {
          forwardSetCookie(event.headers, responseInit);
        }
      },
      // A rejected session is the case that matters most: the API clears the
      // hint cookie on the same 401 that says the session is gone.
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          forwardSetCookie(error.headers, responseInit);
        }
      }
    })
  );
};
