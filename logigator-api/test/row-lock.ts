import { sql } from 'drizzle-orm';
import type { Database, Transaction } from '../src/database/database.module';

/**
 * Runs something while a row it writes is locked by an uncommitted transaction,
 * and answers what it returned.
 *
 * Two writes landing on one row at the same moment is the interleaving injected
 * requests cannot produce on their own — they run one at a time — and it is the
 * one that decides whether a write is safe. An open transaction reproduces it
 * exactly, and deterministically: everything the racing write does *before* it
 * reaches the row happens while `write` is still invisible, its own statement
 * blocks on the lock, and the commit is what releases it. Under `READ COMMITTED`
 * that statement is then re-evaluated against the committed row — so a write that
 * computes its new value in SQL picks the fresh one up, and one that carries a
 * value it read earlier writes the stale one back.
 *
 * The wait is observed rather than slept through, so the ordering is a fact of
 * the run and not a guess about timing.
 */
export async function whileRowLocked<T>(
  db: Database,
  write: (tx: Transaction) => Promise<unknown>,
  racing: () => Promise<T>
): Promise<T> {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = db.transaction(async (tx) => {
    await write(tx);
    await gate;
  });

  try {
    const pending = racing();
    await waitForBlockedStatement(db);
    release?.();
    await held;
    return await pending;
  } finally {
    // The transaction holds a pooled connection until it ends, so a failure
    // above must not leave it open — every later query would wait on it.
    release?.();
    await held.catch(() => undefined);
  }
}

/** Waits until some statement is queued behind a lock in this database. */
async function waitForBlockedStatement(db: Database): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const waiting = await db.execute(
      sql`select 1 from pg_stat_activity
           where datname = current_database() and wait_event_type = 'Lock'
           limit 1`
    );
    if (waiting.rows.length > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('nothing ever blocked on the locked row');
}
