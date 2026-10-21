import * as z from 'zod';
import {
  AVAILABLE_LANGUAGES,
  DEFAULT_LANGUAGE,
  type LanguageId
} from '@logigator/core';
import {
  documentDescriptionSchema,
  documentNameSchema,
  requireSomeField
} from './document.contract';

/**
 * The languages the site is written in. A human version names one of them:
 * a version in a language no page is shown in would never be read.
 */
export const siteLanguageSchema = z.enum(
  AVAILABLE_LANGUAGES.map((language) => language.id) as [
    LanguageId,
    ...LanguageId[]
  ]
);

/**
 * The page language a read resolves texts for. Defaulted, so a client that
 * names none reads what an English page shows.
 */
export const textLanguageQuerySchema = z.object({
  lang: siteLanguageSchema.default(DEFAULT_LANGUAGE)
});

export type TextLanguageQuery = z.infer<typeof textLanguageQuerySchema>;

/**
 * A detected language: an ISO 639-1 code, or `zxx` for a text with nothing to
 * translate. Not limited to the site's languages: an Italian original is `it`.
 * Null while the current text has not been looked at.
 */
const detectedLanguageSchema = z.string().nullable();

/**
 * What a read of somebody else's document adds to its `name` and
 * `description`, which hold the text to show for the requested language: the
 * author's version in that language where one exists, the original otherwise.
 *
 * `textLanguage` is the language of what each field now holds.
 * `machineTranslation` says that the translation endpoint has a text for at
 * least one field in that language. The text itself is never on this response,
 * which a server-rendered page embeds where every crawler can read it.
 */
export const documentTextFields = {
  textLanguage: z
    .object({
      name: detectedLanguageSchema,
      description: detectedLanguageSchema
    })
    .loose(),
  machineTranslation: z.boolean()
} as const;

/**
 * An author's version of the name and description in one site language.
 * `stale` means the original changed after the version was written; the
 * version is still what readers of that language see.
 */
export const documentTextVersionSchema = z
  .object({
    language: siteLanguageSchema,
    name: z.string().nullable(),
    description: z.string().nullable(),
    stale: z.boolean()
  })
  .loose();

export type DocumentTextVersion = z.infer<typeof documentTextVersionSchema>;

/**
 * What an owner's read adds: the detected languages of the original, and the
 * author's own versions. Machine translations are not among them; an owner
 * reads those where every reader does.
 */
export const ownerTextFields = {
  nameLanguage: detectedLanguageSchema,
  descriptionLanguage: detectedLanguageSchema,
  texts: z.array(documentTextVersionSchema)
} as const;

/**
 * What writing or removing an author's version answers with: the owner's text
 * fields as they stand afterwards, the same ones the owner's reads carry.
 */
export const documentTextsResponseSchema = z.object(ownerTextFields).loose();

export type DocumentTextsResponse = z.infer<typeof documentTextsResponseSchema>;

/**
 * Writing the author's version in one language. It replaces the version
 * whole: a field left out has no text in that language, and readers get the
 * original for it.
 */
export const putDocumentTextRequestSchema = requireSomeField(
  z.object({
    name: documentNameSchema.optional(),
    description: documentDescriptionSchema.optional()
  })
);

export type PutDocumentTextRequest = z.infer<
  typeof putDocumentTextRequestSchema
>;

/**
 * The machine translation of a document into one site language, fetched when
 * a reader asks for it. A field is null where the reader is shown nothing to
 * swap: an author's version, an original already in that language, or a text
 * the translator kept as it is.
 */
export const documentTranslationResponseSchema = z
  .object({
    language: siteLanguageSchema,
    name: z.string().nullable(),
    description: z.string().nullable(),
    /** What each translated field was translated from. */
    sourceLanguage: z
      .object({
        name: detectedLanguageSchema,
        description: detectedLanguageSchema
      })
      .loose()
  })
  .loose();

export type DocumentTranslationResponse = z.infer<
  typeof documentTranslationResponseSchema
>;
