import { Migration } from './migration';
import { legacyToV2Migration } from './legacy-to-v2.migration';

/**
 * The ordered migration chain. `migrateToCurrent` walks it, applying the entry
 * whose `from` matches the document's current version until it reaches
 * `CURRENT_FILE_VERSION`.
 *
 * The legacy→v2 entry is registry-backed (see its docs); future native
 * version→version migrations are pure data transforms appended here. (The v1
 * native format never shipped, so it has no migration of its own.)
 */
export const MIGRATIONS: Migration[] = [legacyToV2Migration];
