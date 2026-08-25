import { z } from 'zod';

/**
 * A client-side error report.
 *
 * This is the one endpoint whose shape is fixed from outside: the editor already
 * posts it, in the field-by-field shape the legacy backend grew additively, and
 * a report arriving during the cutover must not be rejected for being what it
 * has always been. So every field stays optional and keeps its name — including
 * `project`, the legacy positional payload only the old editor sends, which is
 * accepted as an opaque object rather than modelled.
 *
 * Nothing here is trusted for anything but a log line: it is unauthenticated,
 * self-reported, and rate-limited on the way in.
 */
export const reportClientInfoSchema = z
  .object({
    browser: z.string().max(200).optional(),
    os: z.string().max(200).optional(),
    renderingContext: z.string().max(100).optional(),
    gpu: z.string().max(300).optional(),
    windowWidth: z.number().optional(),
    windowHeight: z.number().optional(),
    screenWidth: z.number().optional(),
    screenHeight: z.number().optional(),
    devicePixelRatio: z.number().optional(),
    locale: z.string().max(35).optional(),
    url: z.string().max(2048).optional(),
    workMode: z.string().max(50).optional(),
    simulationRunning: z.boolean().optional(),
    touch: z.boolean().optional()
  })
  .loose();

export type ReportClientInfo = z.infer<typeof reportClientInfoSchema>;

/**
 * The caps are the point of the schema here — a report is an unauthenticated
 * write of attacker-chosen text, and the only defence against one used as
 * storage is a bound on every field.
 */
export const reportErrorRequestSchema = z
  .object({
    /** Which client sent it; the current editor sends `editor-v2`. */
    source: z.string().max(50).optional(),
    /** Ties the report to the matching analytics exception event. */
    correlationId: z.string().max(100).optional(),
    line: z.number().optional(),
    col: z.number().optional(),
    file: z.string().max(2048).optional(),
    userAgent: z.string().max(500).optional(),
    message: z.string().max(4000).optional(),
    stack: z.string().max(20_000).optional(),
    userMessage: z.string().max(4000).optional(),
    client: reportClientInfoSchema.optional(),
    /** Recent client log lines leading up to the failure. */
    logs: z.string().max(100_000).optional(),
    /** The native project dump, as an opaque JSON string. */
    projectDump: z.string().max(2_000_000).optional(),
    /** The legacy positional payload; only the old editor sends it. */
    project: z.looseObject({}).optional()
  })
  .loose();

export type ReportErrorRequest = z.infer<typeof reportErrorRequestSchema>;

/**
 * Acknowledgement only. What a deployment does with a report — mail it, log it,
 * drop it — is its own configuration, and telling a client which would say more
 * about the server than the client has any use for.
 */
export const reportErrorResponseSchema = z
  .object({ received: z.boolean() })
  .loose();

export type ReportErrorResponse = z.infer<typeof reportErrorResponseSchema>;
