import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compareMigrations,
  describeMigrationDrift,
  isAligned,
  readLocalMigrations,
  type MigrationRef
} from './migration-state';

const first: MigrationRef = { name: '20260817092426_first', hash: 'aaa' };
const second: MigrationRef = { name: '20260824190805_second', hash: 'bbb' };

describe('compareMigrations', () => {
  it('reports no drift when the applied set is the checked-in set', () => {
    const drift = compareMigrations([first, second], [second, first]);

    expect(drift).toEqual({ pending: [], unknown: [], diverged: [] });
    expect(isAligned(drift)).toBe(true);
  });

  it('reports a checked-in migration the database has not applied', () => {
    const drift = compareMigrations([first, second], [first]);

    expect(drift.pending).toEqual([second.name]);
    expect(drift.unknown).toEqual([]);
  });

  it('reports an applied migration this build does not carry', () => {
    const drift = compareMigrations([first], [first, second]);

    expect(drift.unknown).toEqual([second.name]);
    expect(drift.pending).toEqual([]);
  });

  it('reports a migration whose file changed after it was applied', () => {
    const drift = compareMigrations([first], [{ ...first, hash: 'edited' }]);

    // The name is on both sides, so only the digest can tell them apart.
    expect(drift.diverged).toEqual([first.name]);
    expect(drift.pending).toEqual([]);
    expect(drift.unknown).toEqual([]);
  });

  it('treats a nameless database as behind by every migration', () => {
    const drift = compareMigrations([first, second], []);

    expect(drift.pending).toEqual([first.name, second.name]);
  });
});

describe('describeMigrationDrift', () => {
  it('names every migration that does not line up', () => {
    const message = describeMigrationDrift(
      compareMigrations([first, second], [{ ...first, hash: 'edited' }])
    );

    expect(message).toContain(first.name);
    expect(message).toContain(second.name);
    // The way out of a refused boot, and the only fixed string in the message.
    expect(message).toContain('DATABASE_MIGRATION_CHECK=false');
  });

  it('leaves out the migrations that do line up', () => {
    const message = describeMigrationDrift(
      compareMigrations([first, second], [first])
    );

    expect(message).toContain(second.name);
    expect(message).not.toContain(first.name);
  });
});

describe('readLocalMigrations', () => {
  it('refuses a folder holding no migrations', async () => {
    // Read as "nothing expected", an empty folder would pass every schema.
    const empty = await mkdtemp(join(tmpdir(), 'logigator-migrations-'));

    expect(() => readLocalMigrations(empty)).toThrow(empty);
  });

  it('reads the migrations in the order they are applied', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'logigator-migrations-'));
    for (const name of [second.name, first.name]) {
      await mkdir(join(folder, name));
      await writeFile(join(folder, name, 'migration.sql'), `-- ${name}`);
    }

    const migrations = readLocalMigrations(folder);

    expect(migrations.map(({ name }) => name)).toEqual([
      first.name,
      second.name
    ]);
    // Distinct SQL, so a shared digest would mean the hash is not read at all.
    expect(migrations[0].hash).not.toEqual(migrations[1].hash);
  });
});
