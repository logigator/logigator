import * as z from 'zod';
import { documentNameSchema, NOT_TRANSLATABLE } from '@logigator/contract';
import { normalizeAuthoredText } from '@logigator/core';
import { type Locale, LOCALES } from '../common/locale';
import type {
  DocumentTranslation,
  TranslatedText
} from './document-translation';
import { checkTranslatedDescription } from './translation-check';

const perLanguage = <S extends z.ZodType>(entry: S) =>
  Object.fromEntries(LOCALES.map((locale) => [locale, entry])) as Record<
    Locale,
    S
  >;

/**
 * Detection and translation's fields of the reply as the model is told them,
 * with no constraint beyond types, for the reason the whole wire schema has
 * none.
 */
export const translationReplyWireShape = {
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
};

const languageCode = z
  .string()
  .trim()
  // A model writing `EN` means `en`; refusing it would spend the retry on case.
  .toLowerCase()
  .regex(/^[a-z]{2}$|^zxx$/, {
    error: 'must be a two-letter ISO 639-1 code in lowercase, or zxx'
  });

/** The same fields as they are parsed, the language codes held to form. */
export const translationReplyShape = {
  ...translationReplyWireShape,
  nameLanguage: languageCode,
  descriptionLanguage: languageCode
};

export type TranslationReply = z.infer<
  z.ZodObject<typeof translationReplyShape>
>;

/** The original a reply's translation is read against. */
export interface TranslationOriginal {
  name: string;
  description: string;
}

/**
 * Reads the translation part of a reply that matched the schema into what may
 * be stored, or the reason it may not.
 *
 * The reply is trimmed to what the stored rows mean:
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
 * fails refuses the whole translation, so the retry can name what went wrong.
 */
export function readTranslation(
  reply: TranslationReply,
  original: TranslationOriginal
):
  | { ok: true; translation: DocumentTranslation }
  | { ok: false; reason: string } {
  const translation = trimReply(reply, original);
  for (const [locale, text] of Object.entries(translation.texts)) {
    if (text.description === null) continue;
    const failure = checkTranslatedDescription(
      original.description,
      text.description
    );
    if (failure !== null) {
      return {
        ok: false,
        reason: `the description for ${locale} was refused because ${failure}`
      };
    }
  }
  return { ok: true, translation };
}

function trimReply(
  reply: TranslationReply,
  original: TranslationOriginal
): DocumentTranslation {
  const name = normalizeAuthoredText(original.name);
  const description = normalizeAuthoredText(original.description);
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
