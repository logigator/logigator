import type { Env } from '../config/env';

/**
 * Whether this deployment can offer Google sign-in.
 *
 * One definition, read both by the flow itself and by `GET /meta` — a client
 * must never be told a provider is available that the routes then refuse, and
 * the environment schema already rejects half-configured credentials.
 */
export function isGoogleAuthConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
