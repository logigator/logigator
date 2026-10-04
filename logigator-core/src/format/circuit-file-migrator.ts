import { MIGRATIONS } from './migrations/migrations';
import { MigrationContext } from './migrations/migration';
import { CURRENT_FILE_VERSION } from './circuit-file-version';
import { CurrentCircuitFile } from './circuit-file.types';
import {
  InvalidFileError,
  UnsupportedVersionError
} from './circuit-file.errors';
import { validateCurrentCircuitFile } from './circuit-file-validator';

/** Reads a document's format version; a missing or non-integer one is v0. */
export function detectVersion(data: unknown): number {
  if (typeof data !== 'object' || data === null) {
    throw new InvalidFileError('File is not an object');
  }
  const version = (data as { version?: unknown }).version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return 0;
  }
  return version;
}

/**
 * Runs the migration chain up to `CURRENT_FILE_VERSION` and structurally
 * validates the result, which is then safe to index into without shape checks.
 * A newer version throws `UnsupportedVersionError`; a gap in the chain or a
 * structurally broken document throws `InvalidFileError`.
 */
export function migrateToCurrent(
  data: unknown,
  ctx: MigrationContext
): CurrentCircuitFile {
  let version = detectVersion(data);
  if (version > CURRENT_FILE_VERSION) {
    throw new UnsupportedVersionError(version, CURRENT_FILE_VERSION);
  }

  let current: unknown = data;
  while (version < CURRENT_FILE_VERSION) {
    const migration = MIGRATIONS.find((m) => m.from === version);
    if (!migration) {
      throw new InvalidFileError(`No migration path from version ${version}`);
    }
    current = migration.migrate(current, ctx);
    ctx.log.info(`Migrated circuit ${migration.from} -> ${migration.to}`);
    version = migration.to;
  }

  return validateCurrentCircuitFile(current);
}
