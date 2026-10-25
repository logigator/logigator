import { sql } from 'drizzle-orm';
import type { Database, Transaction } from '../src/database/database.module';

/**
 * Runs `racing` while a row it writes is locked by an uncommitted transaction,
 * and answers what it returned.
 *
 * Injected requests run one at a time, so this is the only way to reach the
 * interleaving that decides whether a write is safe. Everything `racing` does
 * before it reaches the row happens while `write` is still invisible; its
 * statement then blocks until the commit. Under `READ COMMITTED` that statement
 * is re-evaluated against the committed row, so a write computing its value in
 * SQL picks the fresh one up and one carrying a value it read earlier writes
 * the stale one back.
 *
 * The wait is observed rather than slept through, so the ordering is a fact of
 * the run.
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
    // The transaction holds a pooled connection until it ends; left open, every
    // later query waits on it.
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
