import { z } from 'zod';

/**
 * Every environment variable the API reads. Configuration is env-only — there
 * is no `config/*.json` convention any more — and it is validated once, at
 * bootstrap, so a misconfigured deployment fails immediately with a readable
 * report instead of on the first request that happens to need a value.
 */
export const envSchema = z.object({
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
  REDIS_KEY_PREFIX: z.string().min(1).default('lg:')
});

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
