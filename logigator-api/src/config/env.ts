import { z } from 'zod';

/**
 * The session secret a development machine runs on. A fixed constant rather
 * than a per-boot random value: the dev loop restarts on every edit, and a
 * fresh secret each time would sign every developer out.
 */
export const DEVELOPMENT_SESSION_SECRET =
  'logigator-development-session-secret';

/**
 * Every environment variable the API reads, validated once at bootstrap so a
 * misconfigured deployment fails immediately with a readable report.
 */
const variables = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://logigator:logigator@postgres:5432/logigator'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),
  /**
   * Whether boot requires the database to be on exactly the migrations this
   * build carries. On by default: a schema the code does not expect is a
   * failure that surfaces as a wrong answer on some later request, and a
   * process that refuses to start is the one shape a deploy notices. Turn it
   * off only to force a boot the check would refuse, on the operator's word
   * that the schema is compatible.
   */
  DATABASE_MIGRATION_CHECK: z.stringbool().default(true),

  REDIS_URL: z.string().min(1).default('redis://redis:6379'),
  /**
   * Namespace for every key this API writes. Development shares one Redis with
   * the legacy backend, and a session id is a session id in both.
   */
  REDIS_KEY_PREFIX: z.string().min(1).default('lg:'),

  /**
   * Where the site is reachable from outside. Mails build their links from it,
   * so it must be an address a recipient can open, not the container's.
   */
  PUBLIC_URL: z.string().min(1).default('http://logigator.test'),
  /**
   * `smtps://user:pass@smtp.example.com:465`. Unset means mails are logged
   * instead of sent.
   */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('Logigator <noreply@logigator.com>'),
  /** Where client-side error reports are mailed. Unset means logged only. */
  REPORT_MAIL_TO: z.string().optional(),

  /**
   * Both unset means Google sign-in is off; `GET /meta` reports whether it is
   * available, so a client never discovers that from a failing route.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /** Defaults to this API's callback route under `PUBLIC_URL`. */
  GOOGLE_CALLBACK_URL: z.string().optional(),
  /**
   * Where the browser lands after an OAuth round trip, reading `?error=` on
   * failure. Fixed rather than taken from the request: a redirect a caller can
   * choose is an open redirect.
   */
  OAUTH_RETURN_URL: z.string().optional(),

  /**
   * Root of the volume that holds derived, browser-served files. Relative paths
   * resolve from the working directory.
   */
  STORAGE_DIR: z.string().min(1).default('data/storage'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .default(5 * 1024 * 1024),
  /**
   * How long an asset directory no row points at survives the sweep. An upload
   * in flight is a directory nothing names *yet*, indistinguishable from an
   * orphan except by age.
   */
  STORAGE_SWEEP_GRACE_MINUTES: z.coerce.number().int().min(0).default(1440),

  /** Signs the session cookie; `@fastify/session` requires 32+ characters. */
  SESSION_SECRET: z.string().min(32).default(DEVELOPMENT_SESSION_SECRET),
  SESSION_COOKIE_NAME: z.string().min(1).default('lg_sid'),
  /** How long a session survives its last refresh. */
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).default(30),
  /**
   * How stale a session may get before a response refreshes it. Sessions slide,
   * and sliding is not free — a store write and two `Set-Cookie` headers on
   * every response — while a session pushed out to its full lifetime is no
   * shorter for having been pushed an hour ago. `0` refreshes on every
   * response, which is what a lifetime measured in minutes would want.
   */
  SESSION_TOUCH_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(60),
  /**
   * Defaults to on in production, where Caddy terminates TLS, and off elsewhere
   * so a plain-HTTP development origin can still hold a session.
   */
  COOKIE_SECURE: z.stringbool().optional(),
  /** Set to share cookies across subdomains; unset keeps them host-only. */
  COOKIE_DOMAIN: z.string().optional(),

  /**
   * Which callers' `X-Forwarded-*` headers to believe, so `request.ip` is the
   * real client address. `false` (the default) believes none, `true` believes
   * everyone — safe only where nothing but the proxy can reach the process —
   * and anything else names the proxy: the presets `loopback`, `linklocal`,
   * `uniquelocal`, or a comma-separated list of addresses and CIDR ranges. A
   * hop count cannot say who may be in the chain, so anyone reaching the
   * process directly passes for the proxy (Fastify GHSA-3m5p-2c4r-xxw2). Bare
   * digits are refused here because Fastify's matcher would read `1` as the
   * address `0.0.0.1` and boot trusting nothing real.
   */
  TRUST_PROXY: z
    .string()
    .min(1)
    .refine((value) => !/^\d+$/.test(value.trim()), {
      error:
        'must name the proxies rather than count them: a preset (loopback, linklocal, uniquelocal), a comma-separated list of addresses and CIDR ranges, true where nothing but the proxy can reach the process, or false to trust none'
    })
    .default('false'),

  /** Lifetime of the one-shot mail tokens (verification, password reset). */
  AUTH_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).default(60),
  /** Cost of new hashes; existing ones carry their own and still verify. */
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
    if (secure && resolveTrustProxy(ctx.value.TRUST_PROXY) === false) {
      // `@fastify/session` refuses a `Secure` cookie over a connection it
      // believes is plain, and it believes that whenever `X-Forwarded-Proto` is
      // untrusted. The login then 200s with no session, so this is a boot
      // failure rather than a warning.
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.TRUST_PROXY,
        path: ['TRUST_PROXY'],
        message:
          'must name the proxy when cookies are Secure — the process serves plain HTTP, so a TLS-terminating proxy sits in front and its forwarding headers have to be trusted for sessions to be written at all'
      });
    }
  })
  .check((ctx) => {
    const lifetimeMinutes = ctx.value.SESSION_MAX_AGE_DAYS * 24 * 60;
    if (ctx.value.SESSION_TOUCH_INTERVAL_MINUTES >= lifetimeMinutes) {
      // A session refreshed less often than it expires never slides at all, and
      // the symptom is every account being signed out a fixed time after
      // signing in — a week later, with nothing in the logs to connect it.
      ctx.issues.push({
        code: 'custom',
        input: ctx.value.SESSION_TOUCH_INTERVAL_MINUTES,
        path: ['SESSION_TOUCH_INTERVAL_MINUTES'],
        message:
          'must be shorter than SESSION_MAX_AGE_DAYS, which is the window it refreshes a session within'
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
  // Resolved here so every consumer reads a value rather than re-deriving the
  // rules.
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    TRUST_PROXY: resolveTrustProxy(env.TRUST_PROXY),
    GOOGLE_CALLBACK_URL:
      env.GOOGLE_CALLBACK_URL ?? `${env.PUBLIC_URL}/api/auth/google/callback`,
    OAUTH_RETURN_URL: env.OAUTH_RETURN_URL ?? `${env.PUBLIC_URL}/login`
  }));

/**
 * The configured value in the shape Fastify's `trustProxy` takes. An address
 * list or a preset is Fastify's own vocabulary and is handed over untouched, so
 * a malformed one is rejected by the matcher that uses it.
 */
function resolveTrustProxy(value: string): boolean | string {
  const configured = value.trim();
  if (configured === 'false') return false;
  if (configured === 'true') return true;
  return configured;
}

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

/**
 * Validates a raw environment. Blank values are treated as absent: an unset
 * variable in a compose file arrives as `''` and falls back to the default.
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
