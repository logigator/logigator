import * as z from 'zod';

/** One dependency's verdict. `error` carries the failure for an operator to read. */
export const healthCheckSchema = z
  .object({
    ok: z.boolean(),
    error: z.string().optional()
  })
  .loose();

export type HealthCheck = z.infer<typeof healthCheckSchema>;

/**
 * Whether the API can serve requests that touch its backing services. A failure
 * is a `503` with the standard error body, per-check failures under `details`,
 * so an orchestrator acts on the status and an operator reads which dependency
 * is down. Liveness is `GET /meta`, which touches nothing external.
 */
export const readinessResponseSchema = z
  .object({
    status: z.literal('ok'),
    checks: z
      .object({
        database: healthCheckSchema,
        redis: healthCheckSchema
      })
      .loose()
  })
  .loose();

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
