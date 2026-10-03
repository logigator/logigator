import { Migration } from './migration';
import { v0ToV1Migration } from './v0-to-v1.migration';
import { v1ToV2Migration } from './v1-to-v2.migration';

/**
 * The ordered migration chain, walked by applying the entry whose `from`
 * matches the document's version until it reaches `CURRENT_FILE_VERSION`. Each
 * entry advances one version, never straight to newest.
 */
export const MIGRATIONS: Migration[] = [v0ToV1Migration, v1ToV2Migration];
