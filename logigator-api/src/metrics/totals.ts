import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import { documentVisibility } from '../database/schema';
import { Metrics } from './metrics';
import { readTotals, type DocumentKind, type Totals } from './totals-queries';

/** How long one reading of the totals is served before the next. */
export const TOTALS_MAX_AGE_MS = 5 * 60 * 1000;

const KINDS: readonly DocumentKind[] = ['project', 'component'];

/**
 * The database's totals as gauges, read at a scrape at most every
 * {@link TOTALS_MAX_AGE_MS}. A failed reading keeps the last values;
 * `logigator_totals_last_read_timestamp_seconds` says how old they are.
 */
@Injectable()
export class DatabaseTotals {
  private readonly logger = new Logger('Metrics');
  private readAt = -Infinity;
  private reading: Promise<void> | null = null;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly metrics: Metrics
  ) {}

  /** Never rejects. */
  refresh(): Promise<void> {
    if (this.reading) return this.reading;
    if (Date.now() - this.readAt < TOTALS_MAX_AGE_MS) return Promise.resolve();
    this.reading = this.read().finally(() => {
      this.reading = null;
    });
    return this.reading;
  }

  private async read(): Promise<void> {
    try {
      // One snapshot for every count, and nothing here may write.
      const totals = await this.db.transaction(
        (tx) => readTotals(tx, this.env.TEXT_ANALYSIS_WORKER_ENABLED),
        { isolationLevel: 'repeatable read', accessMode: 'read only' }
      );
      writeTotals(this.metrics, totals);
      this.metrics.totalsReadAt.setToCurrentTime();
    } catch (error) {
      this.logger.error('Reading the database totals failed', error);
    }
    this.readAt = Date.now();
  }
}

/**
 * Sets every label combination, zeros included, so a series never vanishes
 * when its count drops to nothing.
 */
export function writeTotals(metrics: Metrics, totals: Totals): void {
  for (const [state, value] of Object.entries(totals.users)) {
    metrics.users.set({ state }, value);
  }
  for (const kind of KINDS) {
    for (const visibility of documentVisibility.enumValues) {
      for (const hidden of [false, true]) {
        const group = totals.documents.find(
          (g) =>
            g.kind === kind &&
            g.visibility === visibility &&
            g.hidden === hidden
        );
        metrics.documents.set(
          { kind, visibility, hidden: String(hidden) },
          group?.count ?? 0
        );
      }
    }
  }
  metrics.stars.set(totals.stars);
  for (const [source, value] of Object.entries(totals.openReports)) {
    metrics.documentReportsOpen.set({ source }, value);
  }
  metrics.textsAwaitingCheck.set(totals.textsAwaitingCheck);
  metrics.textsParked.set(totals.textsParked);
  for (const [type, value] of Object.entries(totals.storageBytes)) {
    metrics.storageBytes.set({ type }, value);
  }
}
