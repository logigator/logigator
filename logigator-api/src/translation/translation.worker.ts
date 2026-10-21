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
import { components, projects } from '../database/schema';
import type { CircuitTable } from '../documents/circuit-queries';
import { RedisService } from '../redis/redis.service';
import {
  leaseRunningOutAt,
  startOfNextUtcDay,
  utcDay
} from './translation-lease';
import {
  claimPending,
  type ClaimedDocument,
  holdClaimUntil,
  MAX_TRANSLATION_ATTEMPTS,
  recordFailure,
  releaseClaim,
  settleTranslation,
  stillSendable
} from './translation-queries';
import { NOT_TRANSLATABLE } from './translation-reply';
import { documentShortcut } from './translation-shortcuts';
import {
  type TranslationFailure,
  TRANSLATOR,
  type Translator
} from './translator';

/**
 * The worker's sense of time, for everything it decides in memory: when a
 * pause ends and which UTC day a call is counted on. A provider so the E2E
 * harness can move it; the database keeps its own clock for leases and the
 * debounce.
 */
export interface TranslationClock {
  now(): number;
}

export const TRANSLATION_CLOCK = Symbol('TRANSLATION_CLOCK');

export const systemClock: TranslationClock = { now: () => Date.now() };

/** How often a budget pause asks the key whether it may resume. */
const BUDGET_RECHECK_MS = 30 * 60_000;
/**
 * How long a configuration pause waits before it tries one call again. One
 * failed call an hour is also one error in the log an hour, until somebody
 * fixes the key or the preset.
 */
const CONFIGURATION_RETRY_MS = 60 * 60_000;
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

const INTERVAL_NAME = 'translation-worker';

/** Why the loop is not claiming: a route that failed, or the whole system. */
interface Pause {
  kind: 'backoff' | 'budget' | 'configuration';
  until: number;
}

/**
 * Detects and translates the names and descriptions of shared documents, a
 * few at a time, oldest edit first.
 *
 * Registered only where translation is switched on and a key is configured.
 * Reads never depend on it: they answer from the database, so translations
 * made while it ran are served as long as their text is current.
 *
 * Failures are handled by what they say about the next call. A document
 * failure counts against that text, which is parked after
 * {@link MAX_TRANSLATION_ATTEMPTS}. A transient one backs the loop off and
 * counts nothing. A system one pauses the loop until the budget allows again
 * or the configuration is fixed. Whatever the batch still held when the loop
 * stops is released, so another tick or another instance takes it up.
 */
@Injectable()
export class TranslationWorker
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TranslationWorker.name);

  private pause: Pause | null = null;
  /** The pause the loop last came out of, until a call shows it is over. */
  private lifted: Pause['kind'] | null = null;
  private transientStreak = 0;
  /**
   * Whether each tick asks the key for its remaining budget first. Off for
   * good once the key endpoint refuses this key: there is then no reading to
   * go by, and a spent limit surfaces as a classified failure of the call.
   */
  private budgetCheck = true;
  /** The last budget reading, so a run of unreadable ones logs once. */
  private lastBudget: 'available' | 'exhausted' | 'unavailable' = 'available';
  private projectsFirst = true;
  private stopping = false;
  private running: Promise<void> | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Database,
    @Inject(TRANSLATOR) private readonly translator: Translator,
    @Inject(TRANSLATION_CLOCK) private readonly clock: TranslationClock,
    private readonly redis: RedisService,
    private readonly scheduler: SchedulerRegistry
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
        this.env.TRANSLATION_POLL_SECONDS * 1000
      )
    );
  }

  /** Lets the document in flight finish; the rest of the batch is released. */
  async beforeApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.running;
  }

  /**
   * One pass: claim and translate a batch of each kind. A tick that is due
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
      if (!(await this.mayProceed())) return;

      // Alternating which kind goes first keeps a pause that lands
      // mid-tick from starving the second.
      const tables: CircuitTable[] = this.projectsFirst
        ? [projects, components]
        : [components, projects];
      this.projectsFirst = !this.projectsFirst;

      // Owners found over their daily limit in this tick, so their other
      // documents are held without another count.
      const overLimit = new Set<string>();
      for (const table of tables) {
        if (this.halted()) return;
        const claimed = await claimPending(this.db, table, {
          debounceSeconds: this.env.TRANSLATION_DEBOUNCE_SECONDS,
          batch: this.env.TRANSLATION_BATCH
        });
        for (const [index, claim] of claimed.entries()) {
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
      this.logger.error('Translation tick failed', error);
    }
  }

  private halted(): boolean {
    return this.stopping || this.pause !== null;
  }

  /**
   * Whether this tick may claim: no pause in force, and budget left. A spent
   * budget is a pause like the one a call's limit error starts, so the key is
   * asked again only every half hour.
   */
  private async mayProceed(): Promise<boolean> {
    const now = this.clock.now();
    if (this.pause) {
      if (now < this.pause.until) return false;
      this.lifted = this.pause.kind;
      this.pause = null;
    }
    if (!this.budgetCheck || (await this.budgetAllows())) return true;
    this.pause = { kind: 'budget', until: now + BUDGET_RECHECK_MS };
    return false;
  }

  /**
   * The key's word on one more call. Only a spent budget stops the tick. A
   * key endpoint that cannot be reached says nothing about the budget, and the
   * key's limit holds on OpenRouter's side whatever is read here: a call made
   * past it fails as a budget pause, costs nothing, and stops the loop the
   * same way. Skipping instead would stop translation whenever that one
   * endpoint is unwell while the completions work.
   */
  private async budgetAllows(): Promise<boolean> {
    const budget = await this.translator.readBudget();
    const previous = this.lastBudget;
    this.lastBudget = budget.kind === 'refused' ? 'available' : budget.kind;
    switch (budget.kind) {
      case 'exhausted':
        // Logged when the wait begins, not on each half-hourly look.
        if (this.lifted !== 'budget') {
          this.logger.warn(
            `Translation paused for budget: the key has $${budget.remainingUsd} left`
          );
        }
        return false;
      case 'refused':
        this.budgetCheck = false;
        this.logger.warn(
          `The key endpoint refuses this key (${budget.status}); translation goes by the calls' own failures from here on`
        );
        return true;
      case 'unavailable':
        if (previous !== 'unavailable') {
          this.logger.warn(
            `The key's budget could not be read (${budget.reason}); translating anyway`
          );
        }
        return true;
      case 'available':
        return true;
    }
  }

  private async process(
    table: CircuitTable,
    claim: ClaimedDocument,
    overLimit: Set<string>
  ): Promise<void> {
    if (await this.settleWithoutModel(table, claim)) return;

    if (!(await stillSendable(this.db, table, claim))) {
      // Made private or edited since the claim: the first may not be sent,
      // and the second's result would be discarded.
      await releaseClaim(this.db, table, claim);
      return;
    }

    const counter = overLimit.has(claim.userId)
      ? null
      : await this.reserveCall(claim.userId);
    if (counter === null) {
      if (!overLimit.has(claim.userId)) {
        this.logger.log(
          `Owner ${claim.userId} reached the daily translation limit; their documents wait for the next UTC day`
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

    const outcome = await this.translator.translate(
      {
        name: claim.name,
        description: claim.description,
        hint: claim.textLanguageHint
      },
      claim.id
    );
    // The reservation counted the first call; a retry is a call too.
    if (outcome.calls.length > 1) {
      await this.redis.client.incrBy(counter, outcome.calls.length - 1);
    }

    if (outcome.kind === 'success') {
      this.callWorked();
      const { translation } = outcome;
      const written = await settleTranslation(this.db, table, claim, {
        nameLanguage: translation.nameLanguage,
        descriptionLanguage: translation.descriptionLanguage,
        texts: translation.texts,
        model: outcome.model
      });
      // An edit landed during the call: the result describes a text that is
      // gone. The new one is claimable once it settles.
      if (!written) await releaseClaim(this.db, table, claim);
      return;
    }

    await this.handleFailure(table, claim, outcome);
  }

  /**
   * Marks a document done where nothing needs the model: every field is
   * either without linguistic content or written by its author in every site
   * language. Returns whether the claim is finished with.
   */
  private async settleWithoutModel(
    table: CircuitTable,
    claim: ClaimedDocument
  ): Promise<boolean> {
    const shortcut = documentShortcut(claim);
    const requireHuman = (['name', 'description'] as const).filter(
      (field) => shortcut[field] === 'human'
    );
    // Null for a field its authors settled: there is no original language a
    // reader is ever shown it in.
    const settled = await settleTranslation(
      this.db,
      table,
      claim,
      {
        nameLanguage:
          shortcut.name === NOT_TRANSLATABLE ? NOT_TRANSLATABLE : null,
        descriptionLanguage:
          shortcut.description === NOT_TRANSLATABLE ? NOT_TRANSLATABLE : null,
        texts: {},
        model: null
      },
      requireHuman
    );
    if (settled) return true;
    if (requireHuman.length > 0) return false;

    // Nothing to ask the model, and the guard refused only because the text
    // moved; the new one gets its own claim.
    await releaseClaim(this.db, table, claim);
    return true;
  }

  /**
   * Counts one call against the owner's UTC day before it is made, so the
   * count holds whether or not it succeeds. Counting first is what keeps two
   * instances from both making the owner's last call. Returns the counter's
   * key, or null when the owner is over the limit and no call may be made.
   */
  private async reserveCall(userId: string): Promise<string | null> {
    const key = `translation:user:${userId}:${utcDay(this.clock.now())}`;
    const count = await this.redis.countInWindow(key, USER_COUNTER_TTL_SECONDS);
    return count <= this.env.TRANSLATION_DAILY_LIMIT_PER_USER
      ? this.redis.key(key)
      : null;
  }

  private async handleFailure(
    table: CircuitTable,
    claim: ClaimedDocument,
    failure: TranslationFailure
  ): Promise<void> {
    switch (failure.kind) {
      case 'document': {
        // The route answered, so whatever paused the loop before is over.
        this.callWorked();
        const attempts = await recordFailure(this.db, table, claim);
        if (attempts !== null && attempts >= MAX_TRANSLATION_ATTEMPTS) {
          this.logger.warn(
            `Translation of ${claim.id} failed ${attempts} times and waits for an edit: ${failure.reason}`
          );
        }
        return;
      }
      case 'transient':
        await releaseClaim(this.db, table, claim);
        this.backOff(failure.retryAfterSeconds);
        return;
      case 'system':
        await releaseClaim(this.db, table, claim);
        this.pauseFor(failure);
        return;
    }
  }

  private callWorked(): void {
    this.transientStreak = 0;
    if (this.lifted === 'budget' || this.lifted === 'configuration') {
      this.logger.log(`Translation resumed after a ${this.lifted} pause`);
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
            this.env.TRANSLATION_POLL_SECONDS *
              1000 *
              2 ** this.transientStreak,
            MAX_BACKOFF_MS
          );
    this.pause = { kind: 'backoff', until: this.clock.now() + delay };
    this.lifted = null;
  }

  private pauseFor(
    failure: Extract<TranslationFailure, { kind: 'system' }>
  ): void {
    const now = this.clock.now();
    if (failure.pause === 'budget') {
      // Logged when the pause begins, not on each half-hourly look.
      if (this.lifted !== 'budget') {
        this.logger.warn(`Translation paused for budget: ${failure.reason}`);
      }
      this.pause = { kind: 'budget', until: now + BUDGET_RECHECK_MS };
    } else {
      this.logger.error(
        `Translation paused, the key or the preset needs fixing: ${failure.reason}. One call is retried each hour.`
      );
      this.pause = {
        kind: 'configuration',
        until: now + CONFIGURATION_RETRY_MS
      };
    }
    this.lifted = null;
  }
}
