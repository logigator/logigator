import * as z from 'zod';

/**
 * A client-side error report. The shape is fixed from outside — shipped editors
 * already post it — so every field stays optional and keeps its name, `project`
 * (the positional payload only the old editor sends) included, accepted as an
 * opaque object rather than modelled.
 *
 * Nothing here is trusted for anything but a log line: unauthenticated,
 * self-reported and rate-limited on the way in.
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
 * The caps are the point: a report is an unauthenticated write of
 * attacker-chosen text, and a bound on every field is the only defence against
 * one used as storage.
 */
export const reportErrorRequestSchema = z
  .object({
    /** Which client sent it. */
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
 * Acknowledgement only. What a deployment does with a report is its own
 * configuration, and saying which would tell a client more about the server
 * than it has any use for.
 */
export const reportErrorResponseSchema = z
  .object({ received: z.boolean() })
  .loose();

export type ReportErrorResponse = z.infer<typeof reportErrorResponseSchema>;
