import { z } from 'zod';

/**
 * The session secret a development machine runs on. Every variable is defaulted
 * so a bare `docker compose up` works, and a secret is no exception — but a
 * production deployment holding this value would let anyone forge a session
 * cookie, so the schema refuses to start there. Its being a fixed constant
 * rather than a per-boot random value is deliberate: the dev loop restarts on
 * every edit, and a fresh secret each time would sign every developer out
 * constantly.
 */
export const DEVELOPMENT_SESSION_SECRET =
  'logigator-development-session-secret';

/**
 * Every environment variable the API reads. Configuration is env-only — there
 * is no `config/*.json` convention any more — and it is validated once, at
 * bootstrap, so a misconfigured deployment fails immediately with a readable
 * report instead of on the first request that happens to need a value.
 */
const variables = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  /** Interface the HTTP server binds to; `0.0.0.0` to be reachable in a container. */
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  /**
   * PostgreSQL connection string. The default names the compose service, the
   * same way the legacy backend's config example named `mysql`.
   */
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://logigator:logigator@postgres:5432/logigator'),
  /** Upper bound on pooled connections; the default is `pg`'s own. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  REDIS_URL: z.string().min(1).default('redis://redis:6379'),
  /**
   * Namespace for every key this API writes. Development shares one Redis with
   * the legacy backend until cutover, and a session id is a session id in both —
   * so the prefix is what keeps them from reading each other's keys.
   */
  REDIS_KEY_PREFIX: z.string().min(1).default('lg:'),

  /**
   * Where the site is reachable from outside. Mails build their links from it,
   * so it must be the address a recipient can actually open — not the container's.
   */
  PUBLIC_URL: z.string().min(1).default('http://logigator.test'),
  /**
   * SMTP connection string, credentials included
   * (`smtps://user:pass@smtp.example.com:465`). Unset means mails are rendered
   * and logged instead of sent, which is the only sane development default.
   */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('Logigator <noreply@logigator.com>'),

  /**
   * Google sign-in credentials. Both unset means the feature is off — a client
   * secret has no sensible default, and a deployment without one must still
   * start and serve local logins. `GET /meta` reports whether it is available,
   * so a client never has to discover it from a failing route.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /**
   * Where Google sends the browser back. Must match the redirect URI registered
   * with the OAuth client exactly; defaults to this API's callback route under
   * `PUBLIC_URL`.
   */
  GOOGLE_CALLBACK_URL: z.string().optional(),
  /**
   * Where the browser lands after an OAuth round trip: the landing app's login
   * page, which reads `?error=` on failure. A fixed target rather than one taken
   * from the request — a redirect a caller can choose is an open redirect.
   */
  OAUTH_RETURN_URL: z.string().optional(),

  /**
   * Root of the volume that holds derived, browser-served files (avatars now,
   * previews next). Relative paths resolve from the working directory, which in
   * development is the repository — where `data/` is already ignored.
   */
  STORAGE_DIR: z.string().min(1).default('data/storage'),
  /** Ceiling on any single uploaded file, in bytes. */
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(5 * 1024 * 1024),

  /** Signs the session cookie. `@fastify/session` requires 32 characters or more. */
  SESSION_SECRET: z.string().min(32).default(DEVELOPMENT_SESSION_SECRET),
  SESSION_COOKIE_NAME: z.string().min(1).default('lg_sid'),
  /** How long a session survives. Sliding: every request pushes it out again. */
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).default(30),
  /**
   * Whether cookies are `Secure`. Defaults to on in production, where Caddy
   * terminates TLS, and off elsewhere so a plain-HTTP development origin can
   * still hold a session.
   */
  COOKIE_SECURE: z.stringbool().optional(),
  /** Set to share cookies across subdomains; unset keeps them host-only. */
  COOKIE_DOMAIN: z.string().optional(),

  /**
   * How many reverse proxies sit in front of the process. `1` behind Caddy makes
   * `request.ip` the real client address and `request.protocol` the scheme the
   * browser used; `0` (the default) trusts no forwarding header, since a
   * directly reachable server must not let callers choose their own address and
   * slip the rate limiter.
   *
   * Secure cookies force the question: the process only ever speaks plain HTTP,
   * so `COOKIE_SECURE` means something in front terminates TLS — and the check
   * below refuses to start until that is declared here.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

  /** Lifetime of the one-shot mail tokens (verification, password reset). */
  AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
  /** Cost of new bcrypt hashes. Legacy hashes carry their own and verify unchanged. */
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12)
});

export const envSchema = variables
  .check((ctx) => {
    if (
      ctx.value.NODE_ENV === 'production' &&
      ctx.value.SESSION_SECRET === DEVELOPMENT_SESSION_SECRET
    ) {
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.SESSION_SECRET,
        path: ['SESSION_SECRET'],
        message:
          'must be set to a private value in production — the development default is public'
      });
    }
  })
  .check((ctx) => {
    // Resolved here rather than read off the transform, which has not run yet.
    const secure =
      ctx.value.COOKIE_SECURE ?? ctx.value.NODE_ENV === 'production';
    if (secure && ctx.value.TRUST_PROXY === 0) {
      // `@fastify/session` refuses to write a `Secure` cookie over a connection
      // it believes is plain, and it believes that whenever `X-Forwarded-Proto`
      // is untrusted. The whole login then succeeds and does nothing: a 200, a
      // hint cookie, no session — so this is a boot failure, not a warning.
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.TRUST_PROXY,
        path: ['TRUST_PROXY'],
        message:
          'must be at least 1 when cookies are Secure — the process serves plain HTTP, so a TLS-terminating proxy sits in front and its forwarding headers have to be trusted for sessions to be written at all'
      });
    }
  })
  .check((ctx) => {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = ctx.value;
    // Half-configured is the dangerous state: it looks enabled and fails at the
    // token exchange, after the user has already been to Google and back.
    if (Boolean(GOOGLE_CLIENT_ID) !== Boolean(GOOGLE_CLIENT_SECRET)) {
      ctx.issues.push({
        code: 'custom',
        input: GOOGLE_CLIENT_ID,
        path: ['GOOGLE_CLIENT_ID'],
        message:
          'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together, or neither (which disables Google sign-in)'
      });
    }
  })
  // Resolved here rather than left optional, so every consumer reads a value and
  // nobody re-derives the rules — including the two URLs that default to a path
  // under `PUBLIC_URL`.
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    GOOGLE_CALLBACK_URL:
      env.GOOGLE_CALLBACK_URL ?? `${env.PUBLIC_URL}/api/auth/google/callback`,
    OAUTH_RETURN_URL: env.OAUTH_RETURN_URL ?? `${env.PUBLIC_URL}/login`
  }));

export type Env = z.infer<typeof envSchema>;

/** DI token for the parsed environment. */
export const ENV = Symbol('ENV');

/**
 * Validates a raw environment. Blank values are treated as absent: an unset
 * variable in a compose file or a `.env` line without a value arrives as `''`,
 * which should fall back to the default rather than fail the schema.
 *
 * @throws if any value is missing or malformed, listing every problem at once.
 */
export function loadEnv(source: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value?.trim())
  );

  const result = envSchema.safeParse(present);
  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${z.prettifyError(result.error)}`
    );
  }

  return result.data;
}
