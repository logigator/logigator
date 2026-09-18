import { createWebRequestFromNodeRequest } from '@angular/ssr/node';
import type { IncomingMessage } from 'node:http';

/**
 * Hosts answered for when `NG_ALLOWED_HOSTS` names none. Angular's own list is
 * empty in that case and it refuses every render, so a deployment that forgot
 * the variable is already broken; what is left is the developer running the
 * process directly, whom the CLI's server lets through by a mechanism of its
 * own.
 */
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]', '::1'];

/**
 * The public origin a request arrived at, or `null` for a host this deployment
 * does not answer for.
 *
 * A response that names absolute URLs — the Atom feed — has to know the origin,
 * and the only place it exists is the request. `@angular/ssr` derives the same
 * URL for a render, so the derivation is its own: the proxy headers named in
 * `NG_TRUST_PROXY_HEADERS` and no others, which is what makes the value correct
 * behind Caddy and unforgeable in front of it.
 *
 * The host is then checked against `NG_ALLOWED_HOSTS`, as Angular checks the
 * one it renders for: without it a `Host:` of someone else's choosing would
 * come back inside the feed's links. It refuses rather than allows what the
 * list does not name, Angular's list being empty until the variable sets it.
 */
export function requestOrigin(request: IncomingMessage): string | null {
  let url: URL;
  try {
    url = new URL(
      createWebRequestFromNodeRequest(
        request,
        envList('NG_TRUST_PROXY_HEADERS')
      ).url
    );
  } catch {
    // A `Host` node accepted and `URL` will not parse. Refusing it here leaves
    // the request to the render's own check, which is what answers every other
    // host this cannot serve.
    return null;
  }
  const allowed = envList('NG_ALLOWED_HOSTS') ?? LOOPBACK_HOSTS;
  return isHostAllowed(url.hostname, allowed) ? url.origin : null;
}

/** A comma-separated environment variable, as Angular reads the same two. */
function envList(name: string): string[] | undefined {
  const values = (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

/** Angular's rule: an exact host, `*.domain`, or `*` for every one. */
function isHostAllowed(hostname: string, allowed: readonly string[]): boolean {
  return allowed.some(
    (host) =>
      host === '*' ||
      host === hostname ||
      (host.startsWith('*.') && hostname.endsWith(host.slice(1)))
  );
}
