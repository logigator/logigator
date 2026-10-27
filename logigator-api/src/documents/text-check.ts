import { sql, type SQL } from 'drizzle-orm';
import type { CircuitTable } from './circuit-queries';

/**
 * Whether a document's current name and description are still waiting for
 * their check: no moderation verdict has been obtained for the text it holds
 * (`checked_digest`), and no moderator has cleared that text
 * (`moderated_digest`). A published one is in no listing until one of the two
 * names the current `text_digest`, and its page asks not to be indexed; its
 * link resolves as before.
 *
 * Only while text analysis runs (`analysisRuns`, the env's
 * `TEXT_ANALYSIS_WORKER_ENABLED`): with no key, or with analysis switched off,
 * no check is coming, and nothing waits for one.
 *
 * Visibility is not part of it, as the counts the empty rule reads are not:
 * the listings ask for `public` themselves, and a client that changes a
 * document's visibility in place still knows whether its text was checked.
 *
 * The one statement of the rule. The listings carry its negation and the
 * reads select it, so what a document's owner is told and what the listings
 * do cannot come apart. Every write that changes the text moves the generated
 * digest past both columns, which is what re-gates an edit without a write
 * path having to know about checks; writing an author's version clears both
 * columns itself, since versions are judged with the original.
 */
export function awaitingCheck(
  table: CircuitTable,
  analysisRuns: boolean
): SQL<boolean> {
  if (!analysisRuns) return sql<boolean>`false`;
  return sql<boolean>`(${table.checkedDigest} is distinct from ${table.textDigest}
    and ${table.moderatedDigest} is distinct from ${table.textDigest})`;
}
