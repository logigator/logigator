import type { Env } from '../config/env';

/**
 * Whether this deployment can offer Google sign-in. One definition, read by the
 * flow and by `GET /meta`, so a client is never told a provider is available
 * that the routes then refuse.
 */
export function isGoogleAuthConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
