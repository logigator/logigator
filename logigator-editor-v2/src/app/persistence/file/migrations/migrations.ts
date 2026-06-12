import { Migration } from './migration';
import { v0ToV1Migration } from './v0-to-v1.migration';

/**
 * The ordered migration chain. `migrateToCurrent` walks it, applying the entry
 * whose `from` matches the document's current version until it reaches
 * `CURRENT_FILE_VERSION`. Each entry advances to the next version, never
 * straight to newest.
 *
 * The v0→v1 entry is registry-backed (see its docs); future native
 * version→version migrations are pure data transforms appended here.
 */
export const MIGRATIONS: Migration[] = [v0ToV1Migration];
