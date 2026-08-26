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
 * Readiness: whether the API can serve requests that touch its backing
 * services. Answered with `503` and the standard error body (code
 * `service_unavailable`, per-check failures under `details`) when it cannot, so
 * an orchestrator can act on the status and an operator can read which
 * dependency is down.
 *
 * Liveness is `GET /meta`, which answers without touching anything external.
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
