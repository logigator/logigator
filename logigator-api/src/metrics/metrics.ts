import { Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';

/**
 * In seconds. Metrics outlive the logs' raw durations, so these bounds are
 * the long-term resolution of latency.
 */
export const DURATION_BUCKETS = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10
];

/** A connection pool's state, as `pg`'s `Pool` reports it. */
export interface PoolCounts {
  total: number;
  idle: number;
  waiting: number;
}

/** Who an outbound call went to. */
export type OutboundTarget = 'openrouter' | 'turnstile' | 'google' | 'smtp';

/**
 * Every metric the API writes, on a registry of its own, so a spec can build
 * one and read it back.
 *
 * Series are kept forever: a label value is only ever one of a fixed set the
 * code owns, never an id, link, address, raw path or client-supplied string.
 */
export class Metrics {
  readonly registry = new Registry();

  readonly httpRequests = new Counter({
    name: 'logigator_http_requests_total',
    help: 'Requests answered, by route template, method, status and the contract error code (empty on success).',
    labelNames: ['route', 'method', 'status', 'code'] as const,
    registers: [this.registry]
  });

  readonly httpRequestDuration = new Histogram({
    name: 'logigator_http_request_duration_seconds',
    help: 'Time from receiving a request to finishing its response.',
    labelNames: ['route', 'method'] as const,
    buckets: DURATION_BUCKETS,
    registers: [this.registry]
  });

  readonly httpRequestsInFlight = new Gauge({
    name: 'logigator_http_requests_in_flight',
    help: 'Requests received and not yet answered or abandoned.',
    registers: [this.registry]
  });

  readonly outboundRequests = new Counter({
    name: 'logigator_outbound_requests_total',
    help: 'Calls to services outside the stack, by target and outcome.',
    labelNames: ['target', 'outcome'] as const,
    registers: [this.registry]
  });

  readonly outboundRequestDuration = new Histogram({
    name: 'logigator_outbound_request_duration_seconds',
    help: 'Time an outbound call took, failed ones included.',
    labelNames: ['target'] as const,
    buckets: DURATION_BUCKETS,
    registers: [this.registry]
  });

  readonly openRouterTokens = new Counter({
    name: 'logigator_openrouter_tokens_total',
    help: 'Tokens OpenRouter billed, by the model it named and the token type (prompt, cached, completion).',
    labelNames: ['model', 'type'] as const,
    registers: [this.registry]
  });

  readonly openRouterCost = new Counter({
    name: 'logigator_openrouter_cost_usd_total',
    help: 'What OpenRouter charged, in US dollars, by the model it named.',
    labelNames: ['model'] as const,
    registers: [this.registry]
  });

  readonly mails = new Counter({
    name: 'logigator_mails_total',
    help: 'Mails handed to the transport, by kind and outcome.',
    labelNames: ['kind', 'outcome'] as const,
    registers: [this.registry]
  });

  readonly textAnalysisTexts = new Counter({
    name: 'logigator_text_analysis_texts_total',
    help: 'Texts the analysis worker settled, by outcome (analyzed, failed, parked).',
    labelNames: ['outcome'] as const,
    registers: [this.registry]
  });

  readonly textAnalysisPaused = new Gauge({
    name: 'logigator_text_analysis_paused',
    help: 'Whether the analysis worker is paused, 1 for the active kind of pause (backoff, budget, configuration).',
    labelNames: ['kind'] as const,
    registers: [this.registry]
  });

  readonly textAnalysisOwnerLimitReached = new Counter({
    name: 'logigator_text_analysis_owner_limit_reached_total',
    help: 'Documents left unclaimed because their owner had spent the daily analysis limit.',
    registers: [this.registry]
  });

  readonly moderationVerdicts = new Counter({
    name: 'logigator_moderation_verdicts_total',
    help: 'Machine moderation verdicts, by category and whether the model was certain.',
    labelNames: ['category', 'certain'] as const,
    registers: [this.registry]
  });

  readonly moderationAutoHides = new Counter({
    name: 'logigator_moderation_auto_hides_total',
    help: 'Documents hidden by machine moderation.',
    registers: [this.registry]
  });

  readonly sweepRemoved = new Counter({
    name: 'logigator_sweep_removed_total',
    help: 'What the daily sweeps removed, by sweep.',
    labelNames: ['sweep'] as const,
    registers: [this.registry]
  });

  readonly sweepLastSuccess = new Gauge({
    name: 'logigator_sweep_last_success_timestamp_seconds',
    help: 'When a sweep last finished without failing, as a Unix time. Absent until its first run after a start.',
    labelNames: ['sweep'] as const,
    registers: [this.registry]
  });

  readonly bugReports = new Counter({
    name: 'logigator_bug_reports_total',
    help: 'Client error reports received, by source (editor, other).',
    labelNames: ['source'] as const,
    registers: [this.registry]
  });

  readonly documentReports = new Counter({
    name: 'logigator_document_reports_total',
    help: 'Document reports filed, by source (human, machine).',
    labelNames: ['source'] as const,
    registers: [this.registry]
  });

  readonly cspViolations = new Counter({
    name: 'logigator_csp_violations_total',
    help: 'CSP violations received, by document (site, editor) and effective directive.',
    labelNames: ['document', 'directive'] as const,
    registers: [this.registry]
  });

  readonly cspReportsDropped = new Counter({
    name: 'logigator_csp_reports_dropped_total',
    help: 'CSP reports held back from the log: unreadable, repeated, or over a limit.',
    registers: [this.registry]
  });

  private poolCounts: (() => PoolCounts) | null = null;

  readonly pgPoolConnections = new Gauge({
    name: 'logigator_pg_pool_connections',
    help: 'Postgres pool connections, by state (total, idle, waiting).',
    labelNames: ['state'] as const,
    registers: [this.registry],
    collect: () => {
      const counts = this.poolCounts?.();
      if (!counts) return;
      for (const state of ['total', 'idle', 'waiting'] as const) {
        this.pgPoolConnections.set({ state }, counts[state]);
      }
    }
  });

  readonly buildInfo = new Gauge({
    name: 'logigator_build_info',
    help: 'The running build, always 1.',
    labelNames: ['version'] as const,
    registers: [this.registry]
  });

  /** Reads the pool's connection counts at every scrape from now on. */
  observePool(counts: () => PoolCounts): void {
    this.poolCounts = counts;
  }

  /**
   * Times one outbound call and counts its outcome: `error` when `call`
   * rejects (passed on unchanged) or when `failed` says its answer is a
   * failure, such as a `fetch` response that is not `ok`; `ok` otherwise.
   */
  async timeOutbound<T>(
    target: OutboundTarget,
    call: () => Promise<T>,
    failed: (result: T) => boolean = () => false
  ): Promise<T> {
    const stop = this.outboundRequestDuration.startTimer({ target });
    try {
      const result = await call();
      this.outboundRequests.inc({
        target,
        outcome: failed(result) ? 'error' : 'ok'
      });
      return result;
    } catch (error) {
      this.outboundRequests.inc({ target, outcome: 'error' });
      throw error;
    } finally {
      stop();
    }
  }
}
