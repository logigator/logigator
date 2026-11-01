import * as z from 'zod';

/**
 * The Turnstile action of each form that carries a challenge. The API refuses a
 * token solved under another action, so one solved for the report dialog does
 * not register an account. Cloudflare allows `[A-Za-z0-9_-]{1,32}`.
 */
export const TURNSTILE_ACTIONS = [
  'register',
  'password-reset',
  'report'
] as const;

export type TurnstileAction = (typeof TURNSTILE_ACTIONS)[number];

/**
 * The token a solved widget hands its form. Optional in the schema: an API
 * without a Turnstile secret ignores it, and a form whose widget failed sends
 * none and lets the API answer `challenge_failed`. Cloudflare's tokens are at
 * most 2048 characters.
 */
export const turnstileTokenSchema = z.string().min(1).max(2048).optional();
