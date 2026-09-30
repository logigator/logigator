import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, eq, lt } from 'drizzle-orm';
import { DB, type Database } from '../database/database.module';
import { users } from '../database/schema';

/**
 * How long an account may wait for its address to be confirmed. A constant
 * rather than an env var, because the privacy policy states it: a deployment
 * that kept accounts longer would be keeping them longer than it says.
 */
export const UNVERIFIED_ACCOUNT_RETENTION_DAYS = 90;

/**
 * Deletes accounts whose address was never confirmed. Such an account cannot
 * sign in, so it owns nothing — no document, no star, no avatar — and the row is
 * all there is to remove.
 *
 * `member_since` is the registration time. An account a migration brings over
 * carries its original date, so the migration has to carry the verified flag
 * over as well: an imported account marked unverified is deleted on the next
 * run.
 */
@Injectable()
export class UnverifiedAccountSweepService {
  private readonly logger = new Logger(UnverifiedAccountSweepService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  /** Nightly, beside the storage sweep; nothing waits on it. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async scheduled(): Promise<void> {
    try {
      const removed = await this.sweep();
      if (removed > 0) {
        this.logger.log(`Deleted ${removed} unverified accounts`);
      }
    } catch (error) {
      // A failed sweep runs again tomorrow; it must not take the process.
      this.logger.error('Sweeping unverified accounts failed', error);
    }
  }

  /** Deletes every unverified account older than the retention window. */
  async sweep(now = new Date()): Promise<number> {
    const cutoff = new Date(
      now.getTime() - UNVERIFIED_ACCOUNT_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );
    const removed = await this.db
      .delete(users)
      .where(and(eq(users.emailVerified, false), lt(users.memberSince, cutoff)))
      .returning({ id: users.id });
    return removed.length;
  }
}
