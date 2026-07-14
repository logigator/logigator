import { MIGRATIONS } from './migrations/migrations';
import { MigrationContext } from './migrations/migration';
import { CURRENT_FILE_VERSION, CurrentCircuitFile } from './circuit-file.types';
import { validateCurrentCircuitFile } from './circuit-file-validator';
import {
  InvalidFileError,
  UnsupportedVersionError
} from './circuit-file.errors';

/**
 * Reads a parsed file's format version. Legacy files have no `version` field, so
 * a missing or non-integer `version` is treated as version 0 (legacy).
 */
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
 * Runs the migration chain to bring any supported document up to
 * `CURRENT_FILE_VERSION`, then structurally validates the result — the
 * returned document is safe to index into without further shape checks. A
 * version newer than we support throws `UnsupportedVersionError`; a gap with
 * no matching migration or a structurally broken document throws
 * `InvalidFileError`.
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
    ctx.logging.info(
      `Migrated circuit ${migration.from} -> ${migration.to}`,
      'CircuitFileMigrator'
    );
    version = migration.to;
  }

  return validateCurrentCircuitFile(current);
}
