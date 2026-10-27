import * as z from 'zod';
import {
  moderationReplySchema,
  moderationReplyWireSchema
} from '../moderation/moderation-reply';
import type { ModerationVerdict } from '../moderation/moderation-verdict';
import type { DocumentTranslation } from '../translation/document-translation';
import {
  readTranslation,
  translationReplyShape,
  translationReplyWireShape
} from '../translation/translation-reply';
import type { AnalysisInput, ReplyRejection } from './text-analyzer';

/**
 * The reply's shape as the model is told it, with no constraint beyond types:
 * translation's fields, then the verdict.
 *
 * Strict structured-output modes differ on `pattern`, `format` and the length
 * keywords, and an endpoint that rejects one fails the whole request, so the
 * schema sent stays in the subset every one of them accepts: objects with
 * every property required and nothing else allowed, plain strings and
 * booleans, and null. What the reply must actually satisfy is
 * {@link analysisReplySchema}.
 */
const analysisReplyWireSchema = z.object({
  ...translationReplyWireShape,
  moderation: moderationReplyWireSchema
});

/**
 * The reply as it is parsed: the wire shape, with the language codes held to
 * form and the verdict to the categories.
 */
export const analysisReplySchema = z.object({
  ...translationReplyShape,
  moderation: moderationReplySchema
});

/**
 * The JSON schema `response_format` carries, generated from the wire schema so
 * the two cannot drift. zod writes a nullable string as a `type` list; that is
 * rewritten as `anyOf`, the form every strict mode reads, and `$schema` is
 * dropped since no endpoint needs it and some refuse unknown top-level keys.
 */
export const ANALYSIS_REPLY_JSON_SCHEMA = portable(
  z.toJSONSchema(analysisReplyWireSchema)
) as Record<string, unknown>;

function portable(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(portable);
  if (typeof schema !== 'object' || schema === null) return schema;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === '$schema') continue;
    if (key === 'type' && Array.isArray(value)) {
      result['anyOf'] = value.map((type: unknown) => ({ type }));
      continue;
    }
    result[key] = portable(value);
  }
  return result;
}

/**
 * The reply's JSON from a message's content. A structured-output endpoint
 * answers with the JSON alone; one that only takes the schema as a hint often
 * wraps it in a fenced block, so the first ```json fence is the fallback.
 *
 * @returns the parsed value, or `undefined` when neither form is JSON.
 */
export function parseReplyContent(content: string): unknown {
  const fenced = /```json[^\n]*\n([\s\S]*?)```/i.exec(content)?.[1];
  for (const candidate of [content, fenced]) {
    if (candidate === undefined) continue;
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // The next form, if there is one.
    }
  }
  return undefined;
}

/**
 * Reads a model's reply into what may be stored, or the reason it may not:
 * JSON, then the schema, then translation's own reading, which trims the
 * reply and checks every description.
 *
 * The verdict comes back from every reply that matches the schema, one whose
 * translation is refused included: the check judges the translation, not the
 * original, and a text that always fails it would otherwise never be judged at
 * all.
 */
export function readAnalysisReply(
  content: string,
  input: AnalysisInput
):
  | { ok: true; translation: DocumentTranslation; verdict: ModerationVerdict }
  | {
      ok: false;
      rejection: ReplyRejection;
      verdict: ModerationVerdict | null;
    } {
  const json = parseReplyContent(content);
  if (json === undefined) {
    return {
      ok: false,
      rejection: { stage: 'parse', reason: 'the reply is not JSON' },
      verdict: null
    };
  }

  const parsed = analysisReplySchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      rejection: {
        stage: 'schema',
        reason: `the reply does not match the schema: ${z.prettifyError(parsed.error)}`
      },
      verdict: null
    };
  }

  const verdict = parsed.data.moderation;
  const read = readTranslation(parsed.data, input);
  if (!read.ok) {
    return {
      ok: false,
      rejection: { stage: 'check', reason: read.reason },
      verdict
    };
  }
  return { ok: true, translation: read.translation, verdict };
}
