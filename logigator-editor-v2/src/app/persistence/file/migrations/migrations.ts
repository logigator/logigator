import { Migration } from './migration';
import { legacyToV1Migration } from './legacy-to-v1.migration';

/**
 * The ordered migration chain. `migrateToCurrent` walks it, applying the entry
 * whose `from` matches the document's current version until it reaches
 * `CURRENT_FILE_VERSION`.
 *
 * The legacy→v1 entry is registry-backed (see its docs); future native
 * version→version migrations are pure data transforms appended here.
 */
export const MIGRATIONS: Migration[] = [legacyToV1Migration];
