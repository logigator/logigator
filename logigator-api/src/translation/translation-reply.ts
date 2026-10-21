import * as z from 'zod';
import { documentNameSchema } from '@logigator/contract';
import { normalizeAuthoredText } from '@logigator/core';
import { type Locale, LOCALES } from '../common/locale';
import { checkTranslatedDescription } from './translation-check';
import type {
  DocumentTranslation,
  ReplyRejection,
  TranslatedText,
  TranslationInput
} from './translator';

/** The mark for a field with nothing to translate (ISO 639-2, "no linguistic content"). */
export const NOT_TRANSLATABLE = 'zxx';

const perLanguage = <S extends z.ZodType>(entry: S) =>
  Object.fromEntries(LOCALES.map((locale) => [locale, entry])) as Record<
    Locale,
    S
  >;

/**
 * The reply's shape as the model is told it, with no constraint beyond types.
 *
 * Strict structured-output modes differ on `pattern`, `format` and the length
 * keywords, and an endpoint that rejects one fails the whole request, so the
 * schema sent stays in the subset every one of them accepts: objects with
 * every property required and nothing else allowed, plain strings, and null.
 * What the reply must actually satisfy is {@link translationReplySchema}.
 */
const translationReplyWireSchema = z.object({
  nameLanguage: z.string(),
  descriptionLanguage: z.string(),
  translations: z.object(
    perLanguage(
      z.object({
        name: z.string().nullable(),
        description: z.string().nullable()
      })
    )
  )
});

const languageCode = z
  .string()
  .trim()
  // A model writing `EN` means `en`; refusing it would spend the retry on case.
  .toLowerCase()
  .regex(/^[a-z]{2}$|^zxx$/, {
    error: 'must be a two-letter ISO 639-1 code in lowercase, or zxx'
  });

/** The reply as it is parsed: the wire shape, with the language codes held to form. */
export const translationReplySchema = translationReplyWireSchema.extend({
  nameLanguage: languageCode,
  descriptionLanguage: languageCode
});

export type TranslationReply = z.infer<typeof translationReplySchema>;

/**
 * The JSON schema `response_format` carries, generated from the wire schema so
 * the two cannot drift. zod writes a nullable string as a `type` list; that is
 * rewritten as `anyOf`, the form every strict mode reads, and `$schema` is
 * dropped since no endpoint needs it and some refuse unknown top-level keys.
 */
export const TRANSLATION_REPLY_JSON_SCHEMA = portable(
  z.toJSONSchema(translationReplyWireSchema)
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
 * Reads a model's reply into what may be stored, or the reason it may not.
 *
 * Beyond the schema, the reply is trimmed to what the stored rows mean:
 *
 * - an entry for the field's own source language is ignored, and so is every
 *   entry of a field detected as `zxx`;
 * - an empty description is `zxx` whatever the model said, since there is
 *   nothing in it to have a language;
 * - an entry equal to the original once both are normalized is dropped, so
 *   "kept as written" reads the same however the model said it;
 * - a machine name the name column would refuse is dropped, and only that
 *   field: the description's translation stands on its own.
 *
 * Every remaining description then has to pass `translation-check`; one that
 * fails refuses the whole reply, so the retry can name what went wrong.
 */
export function readTranslationReply(
  content: string,
  input: TranslationInput
):
  | { ok: true; translation: DocumentTranslation }
  | { ok: false; rejection: ReplyRejection } {
  const json = parseReplyContent(content);
  if (json === undefined) {
    return {
      ok: false,
      rejection: { stage: 'parse', reason: 'the reply is not JSON' }
    };
  }

  const parsed = translationReplySchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      rejection: {
        stage: 'schema',
        reason: `the reply does not match the schema: ${z.prettifyError(parsed.error)}`
      }
    };
  }

  const translation = trimReply(parsed.data, input);
  for (const [locale, text] of Object.entries(translation.texts)) {
    if (text.description === null) continue;
    const failure = checkTranslatedDescription(
      input.description,
      text.description
    );
    if (failure !== null) {
      return {
        ok: false,
        rejection: {
          stage: 'check',
          reason: `the description for ${locale} was refused because ${failure}`
        }
      };
    }
  }
  return { ok: true, translation };
}

function trimReply(
  reply: TranslationReply,
  input: TranslationInput
): DocumentTranslation {
  const name = normalizeAuthoredText(input.name);
  const description = normalizeAuthoredText(input.description);
  const nameLanguage = name === '' ? NOT_TRANSLATABLE : reply.nameLanguage;
  const descriptionLanguage =
    description === '' ? NOT_TRANSLATABLE : reply.descriptionLanguage;

  const texts: Partial<Record<Locale, TranslatedText>> = {};
  for (const locale of LOCALES) {
    const entry = reply.translations[locale];
    const text: TranslatedText = {
      name: keep(entry.name, name, nameLanguage, locale),
      description: keep(
        entry.description,
        description,
        descriptionLanguage,
        locale
      )
    };
    if (
      text.name !== null &&
      !documentNameSchema.safeParse(text.name).success
    ) {
      text.name = null;
    }
    if (text.name !== null || text.description !== null) {
      texts[locale] = text;
    }
  }
  return { nameLanguage, descriptionLanguage, texts };
}

function keep(
  translated: string | null,
  original: string,
  originalLanguage: string,
  locale: Locale
): string | null {
  if (translated === null) return null;
  if (originalLanguage === NOT_TRANSLATABLE || originalLanguage === locale) {
    return null;
  }
  const text = normalizeAuthoredText(translated);
  return text === '' || text === original ? null : text;
}
