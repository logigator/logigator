import { afterEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { MIGRATIONS_SCHEMA, MIGRATIONS_TABLE } from '../src/database/migrate';
import { readLocalMigrations } from '../src/database/migration-state';
import {
  MIGRATIONS_FOLDER_PATH,
  startDatabaseLayer,
  startE2eApp,
  type E2eApp
} from './harness';

/**
 * The startup gate, watched against a real database: the harness migrates one,
 * the spec edits the ledger drizzle's migrator wrote, and the database layer is
 * booted again to see what it makes of the result. That an aligned schema boots
 * is what every other E2E file already proves, this one having the same gate.
 *
 * A tampered ledger is never put back — each case takes a database of its own,
 * which is what the harness hands out per call.
 */
describe('startup schema gate', () => {
  let api: E2eApp | undefined;

  afterEach(async () => {
    await api?.close();
    api = undefined;
  });

  const ledger = sql`${sql.identifier(MIGRATIONS_SCHEMA)}.${sql.identifier(MIGRATIONS_TABLE)}`;

  /** The newest applied migration, which is also the newest checked-in one. */
  async function newestApplied(app: E2eApp): Promise<string> {
    const applied = await app.db.execute<{ name: string }>(
      sql`select name from ${ledger} order by name desc limit 1`
    );
    return applied.rows[0].name;
  }

  it('refuses to boot when a checked-in migration has not been applied', async () => {
    api = await startE2eApp();
    const newest = await newestApplied(api);

    await api.db.execute(sql`delete from ${ledger} where name = ${newest}`);

    await expect(startDatabaseLayer(api.env)).rejects.toThrow(newest);
  });

  it('refuses to boot when the database has never been migrated', async () => {
    api = await startE2eApp();

    // Renamed rather than dropped: the check must read a missing ledger as
    // nothing applied, never create the table the migration runner owns.
    await api.db.execute(sql`alter table ${ledger} rename to __no_ledger`);

    const failure = await startDatabaseLayer(api.env).catch(
      (error: Error) => error
    );

    // Every migration is missing, so every one of them is named.
    for (const { name } of readLocalMigrations(MIGRATIONS_FOLDER_PATH)) {
      expect(failure).toHaveProperty('message', expect.stringContaining(name));
    }
  });

  it('refuses to boot when the database is ahead of this build', async () => {
    api = await startE2eApp();
    const ahead = '29990101000000_from_the_future';

    await api.db.execute(
      sql`insert into ${ledger} ("name", "hash", "created_at") values (${ahead}, 'unknown', 0)`
    );

    // No down migrations exist, so a schema this build cannot have been written
    // against is as fatal as one it is ahead of.
    await expect(startDatabaseLayer(api.env)).rejects.toThrow(ahead);
  });

  it('refuses to boot when an applied migration file has changed since', async () => {
    api = await startE2eApp();
    const newest = await newestApplied(api);

    // The name is still on both sides: only the recorded digest catches this.
    await api.db.execute(
      sql`update ${ledger} set hash = 'edited' where name = ${newest}`
    );

    await expect(startDatabaseLayer(api.env)).rejects.toThrow(newest);
  });

  it('boots a mismatched schema anyway once the check is turned off', async () => {
    api = await startE2eApp({ DATABASE_MIGRATION_CHECK: 'false' });

    await api.db.execute(sql`delete from ${ledger}`);

    const close = await startDatabaseLayer(api.env);
    await close();
  });
});
