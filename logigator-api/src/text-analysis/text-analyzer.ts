import type { Locale } from '../common/locale';
import type { ModerationVerdict } from '../moderation/moderation-verdict';
import type { DocumentTranslation } from '../translation/document-translation';

/**
 * What an analyzer is given about one document: its two texts as stored, the
 * language the writer's interface was in when they were last written, and the
 * author's own versions. The hint is only that — the author never names the
 * original's language, and an English interface writes German text as readily
 * as English.
 */
export interface AnalysisInput {
  name: string;
  description: string;
  hint: string | null;
  /**
   * Shown to readers in place of the original, so they are judged with it.
   * They are never translated: the reply describes the original alone.
   */
  versions: readonly AuthorVersion[];
}

/** The author's own text in one site language; a null field has none. */
export interface AuthorVersion {
  language: Locale;
  name: string | null;
  description: string | null;
}

/**
 * What one call cost and who answered it, as OpenRouter reports it. Fields it
 * leaves out are null rather than guessed.
 */
export interface CallUsage {
  /** The model that answered, never the preset that chose it. */
  model: string | null;
  provider: string | null;
  /** OpenRouter's generation id, which finds the call on its Activity page. */
  generationId: string | null;
  costUsd: number | null;
  promptTokens: number | null;
  /** The part of `promptTokens` the provider read from its prompt cache. */
  cachedTokens: number | null;
  completionTokens: number | null;
}

/**
 * A reply that came back and was refused, which is what the retry names. The
 * reason describes the failure, never the text, so it is safe to log.
 */
export interface ReplyRejection {
  /** Not JSON, not the reply schema, or a translation `translation-check` refuses. */
  stage: 'parse' | 'schema' | 'check';
  reason: string;
}

/**
 * Why a document was not analyzed, by what the caller has to do about it.
 *
 * - `document`: this text failed. It counts an attempt against the text, and
 *   repeating the same request would fail the same way.
 * - `transient`: the route failed, not the text. The lease is released without
 *   counting, and `retryAfterSeconds` is the server's word on when to retry.
 * - `system`: nothing will succeed until something outside the request
 *   changes, so the loop pauses. `budget` lifts by itself once the key's limit
 *   resets; `configuration` needs somebody to fix the key or the preset.
 */
export type AnalysisFailure =
  | { kind: 'document'; reason: string }
  | { kind: 'transient'; reason: string; retryAfterSeconds: number | null }
  | { kind: 'system'; pause: 'budget' | 'configuration'; reason: string };

export type AnalysisOutcome = (
  | {
      kind: 'success';
      translation: DocumentTranslation;
      /** The served model of the call whose reply was kept, for the stored rows. */
      model: string | null;
      /** A kept reply matched the schema, so a verdict is always there. */
      verdict: ModerationVerdict;
    }
  | AnalysisFailure
) & {
  /** Every call made for the outcome, a retried one included. */
  calls: CallUsage[];
  /**
   * The strictest verdict of every reply that matched the schema, a refused
   * translation's included, so failing the translation check is no way past
   * moderation; null when no reply got that far.
   */
  verdict: ModerationVerdict | null;
  /** The call whose reply gave {@link verdict}, for the report. */
  verdictCall: CallUsage | null;
};

/**
 * What the key's own budget says about one more call.
 *
 * `refused` is the key endpoint declining to answer this key at all, which is
 * different from the budget being spent: a caller that gets it has no budget
 * reading to go by, and relies on a limit error from the call itself instead.
 */
export type KeyBudget =
  | { kind: 'available'; remainingUsd: number | null }
  | { kind: 'exhausted'; remainingUsd: number }
  | { kind: 'refused'; status: number }
  | { kind: 'unavailable'; reason: string };

/**
 * Language detection, translation and moderation of a document's name and
 * description, in one call per document. Behind {@link TEXT_ANALYZER} so the
 * E2E harness can run the worker against a fake that never leaves the process.
 */
export interface TextAnalyzer {
  /**
   * Never throws for anything the route or the reply does: every failure comes
   * back classified. `documentId` is for logging, which names the document and
   * never its text.
   */
  analyze(input: AnalysisInput, documentId: string): Promise<AnalysisOutcome>;
  readBudget(): Promise<KeyBudget>;
}

export const TEXT_ANALYZER = Symbol('TEXT_ANALYZER');
