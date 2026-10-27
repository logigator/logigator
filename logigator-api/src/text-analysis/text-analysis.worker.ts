import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ENV, type Env } from '../config/env';
import { DB, type Database } from '../database/database.module';
import {
  components,
  MAX_ANALYSIS_ATTEMPTS,
  projects
} from '../database/schema';
import { type CircuitTable, kindOf } from '../documents/circuit-queries';
import { humanVersionsOf } from '../documents/document-text-queries';
import { MachineModerationService } from '../moderation/machine-moderation.service';
import { RedisService } from '../redis/redis.service';
import { leaseRunningOutAt, startOfNextUtcDay, utcDay } from './analysis-lease';
import {
  claimPending,
  type ClaimedDocument,
  holdClaimUntil,
  recordFailure,
  releaseClaim,
  renewForCall,
  settleAnalysis
} from './analysis-queries';
import {
  type AnalysisFailure,
  type AnalysisOutcome,
  TEXT_ANALYZER,
  type TextAnalyzer
} from './text-analyzer';

/**
 * The worker's sense of time, for everything it decides in memory: when a
 * pause ends and which UTC day a call is counted on. A provider so the E2E
 * harness can move it; the database keeps its own clock for leases and the
 * debounce.
 */
export interface AnalysisClock {
  now(): number;
}

export const ANALYSIS_CLOCK = Symbol('ANALYSIS_CLOCK');

export const systemClock: AnalysisClock = { now: () => Date.now() };

/** How often a budget pause asks the key whether it may resume. */
const BUDGET_RECHECK_MS = 30 * 60_000;
/**
 * How long a configuration pause waits before it tries one call again. One
 * failed call an hour is also one error in the log an hour, until somebody
 * fixes the key or the preset.
 */
const CONFIGURATION_RETRY_MS = 60 * 60_000;
/**
 * How long the document a configuration failure was met on is held out of the
 * queue. The status cannot tell a broken key or preset from a provider that
 * refuses this one request, so the hourly retry goes to the next document
 * instead: a document refused for itself never stands at the head of the
 * queue, and while the configuration stays broken each held one comes back a
 * day later.
 */
const CONFIGURATION_HOLD_MS = 24 * 60 * 60_000;
/** The longest a run of transient failures backs the loop off by. */
const MAX_BACKOFF_MS = 15 * 60_000;
/** The longest a server's `Retry-After` is believed for. */
const MAX_RETRY_AFTER_MS = 60 * 60_000;
/**
 * How long one owner's daily call counter lives. Longer than its day, so a
 * counter is never gone while its day is still running; it is never read
 * after it.
 */
const USER_COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

const INTERVAL_NAME = 'text-analysis-worker';

/** Why the loop is not claiming: a route that failed, or the whole system. */
interface Pause {
  kind: 'backoff' | 'budget' | 'configuration';
  until: number;
}

/**
 * Analyzes the names and descriptions of shared documents, a few at a time,
 * oldest edit first: one call per document detects their language,
 * translates them and gives a moderation verdict.
 *
 * Registered only where text analysis is switched on and a key is
 * configured. Reads never depend on it: they answer from the database, so
 * translations made while it ran are served as long as their text is current.
 *
 * Failures are handled by what they say about the next call. A document
 * failure counts against that text, which is parked after
 * {@link MAX_ANALYSIS_ATTEMPTS}, and reported for a person when none of its
 * calls gave a verdict. A transient one backs the loop off and
 * counts nothing. A system one pauses the loop until the budget allows again
 * or the configuration is fixed, and holds the document of a configuration
 * failure for a day without counting it. Whatever the batch still held when
 * the loop stops is released, so another tick or another instance takes it
 * up.
 *
 * Every call's moderation verdict is handed on before the outcome is handled,
 * whatever the outcome: a text whose translation keeps failing is judged all
 * the same. A verdict also checks the text, in the statement that settles or
 * counts the call, which is what lets a published document into the listings
 * (`text-check.ts`).
 */
@Injectable()
export class TextAnalysisWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TextAnalysisWorker.name);

  private pause: Pause | null = null;
  /** The pause the loop last came out of, until a call shows it is over. */
  private lifted: Pause['kind'] | null = null;
  private transientStreak = 0;
  /**
   * Whether a tick that claimed work asks the key for its remaining budget
   * first. Off for good once the key endpoint refuses this key: there is then
   * no reading to go by, and a spent limit surfaces as a classified failure of
   * the call.
   */
  private budgetCheck = true;
  /** Whether the last budget reading failed, so a run of them logs once. */
  private budgetUnreadable = false;
  private projectsFirst = true;
  private stopping = false;
  private running: Promise<void> | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    @Inject(TEXT_ANALYZER) private readonly analyzer: TextAnalyzer,
    @Inject(ANALYSIS_CLOCK) private readonly clock: AnalysisClock,
    private readonly redis: RedisService,
    private readonly scheduler: SchedulerRegistry,
    private readonly moderation: MachineModerationService
  ) {}

  /**
   * Through the registry rather than `@Interval`, which takes a constant: the
   * period is configuration. The schedule module clears it on shutdown.
   */
  onApplicationBootstrap(): void {
    this.scheduler.addInterval(
      INTERVAL_NAME,
      setInterval(
        () => void this.tick(),
        this.env.TEXT_ANALYSIS_POLL_SECONDS * 1000
      )
    );
  }

  /** Lets the document in flight finish; the rest of the batch is released. */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.running;
  }

  /**
   * One pass: claim and analyze a batch of each kind. A tick that is due
   * while the previous one still runs joins it rather than starting another,
   * so one process never holds two batches.
   */
  tick(): Promise<void> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async run(): Promise<void> {
    try {
      if (!this.mayProceed()) return;

      // Alternating which kind goes first keeps a pause that lands
      // mid-tick from starving the second.
      const tables: CircuitTable[] = this.projectsFirst
        ? [projects, components]
        : [components, projects];
      this.projectsFirst = !this.projectsFirst;

      // Owners found over their daily limit in this tick, so their other
      // documents are held without another count.
      const overLimit = new Set<string>();
      // The key is read once a tick has work, so an empty queue costs no
      // request. A spent budget pauses the loop, and what was claimed is
      // released below like any batch a pause cuts short.
      let budgetRead = !this.budgetCheck;
      for (const table of tables) {
        if (this.halted()) return;
        const claimed = await claimPending(this.db, table, {
          debounceSeconds: this.env.TEXT_ANALYSIS_DEBOUNCE_SECONDS,
          batch: this.env.TEXT_ANALYSIS_BATCH
        });
        for (const [index, claim] of claimed.entries()) {
          if (!budgetRead) {
            budgetRead = true;
            await this.checkBudget();
          }
          if (this.halted()) {
            for (const rest of claimed.slice(index)) {
              await releaseClaim(this.db, table, rest);
            }
            return;
          }
          await this.process(table, claim, overLimit);
        }
      }
    } catch (error) {
      // Rows claimed before the failure come back when their lease runs out.
      this.logger.error('Text analysis tick failed', error);
    }
  }

  private halted(): boolean {
    return this.stopping || this.pause !== null;
  }

  /** Whether this tick may claim: no pause in force, or one that has run out. */
  private mayProceed(): boolean {
    if (this.pause) {
      if (this.clock.now() < this.pause.until) return false;
      this.lifted = this.pause.kind;
      this.pause = null;
    }
    return true;
  }

  /**
   * The key's word on one more call. Only a spent budget stops the tick, as a
   * pause like the one a call's limit error starts, so the key is asked again
   * only every half hour. A key endpoint that cannot be reached says nothing
   * about the budget, and the key's limit holds on OpenRouter's side whatever
   * is read here: a call made past it fails as a budget pause, costs nothing,
   * and stops the loop the same way. Skipping instead would stop the analysis
   * whenever that one endpoint is unwell while the completions work.
   */
  private async checkBudget(): Promise<void> {
    const budget = await this.analyzer.readBudget();
    const wasUnreadable = this.budgetUnreadable;
    this.budgetUnreadable = budget.kind === 'unavailable';
    switch (budget.kind) {
      case 'exhausted':
        this.pauseForBudget(`the key has $${budget.remainingUsd} left`);
        return;
      case 'refused':
        this.budgetCheck = false;
        this.logger.warn(
          `The key endpoint refuses this key (${budget.status}); text analysis goes by the calls' own failures from here on`
        );
        return;
      case 'unavailable':
        if (!wasUnreadable) {
          this.logger.warn(
            `The key's budget could not be read (${budget.reason}); analyzing anyway`
          );
        }
        return;
      case 'available':
        return;
    }
  }

  private async process(
    table: CircuitTable,
    claimed: ClaimedDocument,
    overLimit: Set<string>
  ): Promise<void> {
    const claim = await renewForCall(this.db, table, claimed);
    if (claim === null) {
      // Made private, edited or given a version since the claim: the first
      // may not be sent, and the others' result would be discarded.
      await releaseClaim(this.db, table, claimed);
      return;
    }

    const counter = overLimit.has(claim.userId)
      ? null
      : await this.reserveCall(claim.userId);
    if (counter === null) {
      if (!overLimit.has(claim.userId)) {
        this.logger.log(
          `Owner ${claim.userId} reached the daily text analysis limit; their documents wait for the next UTC day`
        );
      }
      overLimit.add(claim.userId);
      await holdClaimUntil(
        this.db,
        table,
        claim,
        leaseRunningOutAt(startOfNextUtcDay(this.clock.now()))
      );
      return;
    }

    // Read after the renewal: a version written from here on gives the claim
    // up, so the result is never settled for versions the call did not see.
    const stored = await humanVersionsOf(this.db, table, [claim.id]);
    const versions = (stored.get(claim.id) ?? []).map(
      ({ language, name, description }) => ({ language, name, description })
    );
    const outcome = await this.analyzer.analyze(
      {
        name: claim.name,
        description: claim.description,
        hint: claim.textLanguageHint,
        versions
      },
      claim.id
    );
    // The reservation counted the first call; a retry is a call too.
    if (outcome.calls.length > 1) {
      await this.redis.client.incrBy(counter, outcome.calls.length - 1);
    }
    await this.moderate(table, claim, outcome);

    if (outcome.kind === 'success') {
      this.callWorked();
      const written = await settleAnalysis(
        this.db,
        table,
        claim,
        outcome.translation,
        outcome.model
      );
      // An edit or a version landed during the call: the result describes a
      // document that is gone. The new one is claimable once it settles.
      if (!written) await releaseClaim(this.db, table, claim);
      return;
    }

    await this.handleFailure(table, claim, outcome);
  }

  /**
   * Hands the call's verdict to moderation, for the text that was claimed: an
   * edit made during the call leaves a verdict for a text that is gone, which
   * moderation's own digest guard sees. A failure there is logged and leaves
   * the translation to be handled as usual, so a broken report path neither
   * loses a translation nor repeats a paid call.
   */
  private async moderate(
    table: CircuitTable,
    claim: ClaimedDocument,
    outcome: AnalysisOutcome
  ): Promise<void> {
    if (outcome.verdict === null) return;
    try {
      await this.moderation.apply({
        kind: kindOf(table),
        documentId: claim.id,
        textDigest: claim.textDigest,
        verdict: outcome.verdict,
        call: outcome.verdictCall
      });
    } catch (error) {
      this.logger.error(
        `Moderation of ${claim.id} failed; its translation goes on`,
        error
      );
    }
  }

  /**
   * Counts one call against the owner's UTC day before it is made, so the
   * count holds whether or not it succeeds. Counting first is what keeps two
   * instances from both making the owner's last call. Returns the counter's
   * key, or null when the owner is over the limit and no call may be made.
   */
  private async reserveCall(userId: string): Promise<string | null> {
    const key = `text-analysis:user:${userId}:${utcDay(this.clock.now())}`;
    const count = await this.redis.countInWindow(key, USER_COUNTER_TTL_SECONDS);
    return count <= this.env.TEXT_ANALYSIS_DAILY_LIMIT_PER_USER
      ? this.redis.key(key)
      : null;
  }

  private async handleFailure(
    table: CircuitTable,
    claim: ClaimedDocument,
    failure: AnalysisOutcome & AnalysisFailure
  ): Promise<void> {
    switch (failure.kind) {
      case 'document': {
        // The route answered, so whatever paused the loop before is over.
        this.callWorked();
        const attempts = await recordFailure(
          this.db,
          table,
          claim,
          failure.verdict !== null
        );
        if (attempts !== null && attempts >= MAX_ANALYSIS_ATTEMPTS) {
          this.logger.warn(
            `Analysis of ${claim.id} failed ${attempts} times and waits for an edit: ${failure.reason}`
          );
          if (failure.verdict === null) {
            await this.reportUnjudged(table, claim, attempts, failure);
          }
        }
        return;
      }
      case 'transient':
        await releaseClaim(this.db, table, claim);
        this.backOff(failure.retryAfterSeconds);
        return;
      case 'system':
        if (failure.pause === 'configuration') {
          await holdClaimUntil(
            this.db,
            table,
            claim,
            leaseRunningOutAt(this.clock.now() + CONFIGURATION_HOLD_MS)
          );
        } else {
          await releaseClaim(this.db, table, claim);
        }
        this.pauseFor(failure);
        return;
    }
  }

  /**
   * Puts a text that was parked without a verdict in front of a person: it
   * would otherwise wait unchecked, out of the listings, until its author
   * edits it. Moderation's own guard leaves out a text an earlier attempt's
   * verdict already checked. A failure is logged; the text stays parked
   * either way.
   */
  private async reportUnjudged(
    table: CircuitTable,
    claim: ClaimedDocument,
    attempts: number,
    failure: AnalysisOutcome
  ): Promise<void> {
    const call = failure.calls.at(-1) ?? null;
    try {
      await this.moderation.reportUnjudged({
        kind: kindOf(table),
        documentId: claim.id,
        textDigest: claim.textDigest,
        attempts,
        call
      });
    } catch (error) {
      this.logger.error(`Reporting unjudged ${claim.id} failed`, error);
    }
  }

  private callWorked(): void {
    this.transientStreak = 0;
    if (this.lifted === 'budget' || this.lifted === 'configuration') {
      this.logger.log(`Text analysis resumed after a ${this.lifted} pause`);
    }
    this.lifted = null;
  }

  /**
   * Skips ticks for the server's `Retry-After`, or for twice the poll period
   * doubling with each transient failure in a row.
   */
  private backOff(retryAfterSeconds: number | null): void {
    this.transientStreak += 1;
    const delay =
      retryAfterSeconds !== null
        ? Math.min(retryAfterSeconds * 1000, MAX_RETRY_AFTER_MS)
        : Math.min(
            this.env.TEXT_ANALYSIS_POLL_SECONDS *
              1000 *
              2 ** this.transientStreak,
            MAX_BACKOFF_MS
          );
    this.pause = { kind: 'backoff', until: this.clock.now() + delay };
    this.lifted = null;
  }

  private pauseFor(
    failure: Extract<AnalysisFailure, { kind: 'system' }>
  ): void {
    if (failure.pause === 'budget') {
      this.pauseForBudget(failure.reason);
      return;
    }
    this.logger.error(
      `Text analysis paused, the key or the preset needs fixing: ${failure.reason}. One call is retried each hour.`
    );
    this.pause = {
      kind: 'configuration',
      until: this.clock.now() + CONFIGURATION_RETRY_MS
    };
    this.lifted = null;
  }

  private pauseForBudget(reason: string): void {
    // Logged when the pause begins, not on each half-hourly look.
    if (this.lifted !== 'budget') {
      this.logger.warn(`Text analysis paused for budget: ${reason}`);
    }
    this.pause = {
      kind: 'budget',
      until: this.clock.now() + BUDGET_RECHECK_MS
    };
    this.lifted = null;
  }
}
