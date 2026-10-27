import { NOT_TRANSLATABLE } from '@logigator/contract';
import type { LanguageId } from '@logigator/core';

/**
 * Which text a reader is shown for a document's name and description, and
 * whether a machine translation is offered beside it. One pure function over
 * what the database holds, so the flag a listing carries and the fields the
 * translation endpoint answers are the same decision, made once.
 *
 * The two fields are resolved independently: a neutral name and a German
 * description are one document.
 */

export type TextField = 'name' | 'description';

export const TEXT_FIELDS: readonly TextField[] = ['name', 'description'];

/** What the document's own row says about its original texts. */
export interface OriginalTexts {
  name: string;
  description: string;
  textDigest: string;
  /** The digest the detected languages were made for; null before any. */
  analyzedDigest: string | null;
  nameLanguage: string | null;
  descriptionLanguage: string | null;
}

/** The author's version in the reader's language; a null field has none. */
export interface HumanTexts {
  name: string | null;
  description: string | null;
}

/**
 * The machine row in the reader's language: the digest it was written for, and
 * which fields it has a text for. A field the translator kept as it is has
 * none.
 */
export interface MachineTexts {
  sourceDigest: string;
  name: boolean;
  description: boolean;
}

export interface ResolvedField {
  /** What the field shows: the author's version, or the original. */
  text: string;
  /** The language of `text`, or null while it is not known. */
  language: string | null;
  /** Whether the translation endpoint answers a text for this field. */
  machineTranslation: boolean;
}

export interface ResolvedTexts {
  name: ResolvedField;
  description: ResolvedField;
  /** At least one field offers a machine translation. */
  machineTranslation: boolean;
}

/**
 * The languages of the original, or null for both while they describe an
 * older text. A detection is valid only for the digest it was made for, so an
 * edit withdraws it in the same moment it moves the digest, before the worker
 * looks at the new text.
 */
export function currentLanguages(
  row: Pick<
    OriginalTexts,
    'textDigest' | 'analyzedDigest' | 'nameLanguage' | 'descriptionLanguage'
  >
): { name: string | null; description: string | null } {
  const current = row.analyzedDigest === row.textDigest;
  return {
    name: current ? row.nameLanguage : null,
    description: current ? row.descriptionLanguage : null
  };
}

/**
 * Resolves both fields for a reader whose page is in `language`.
 *
 * Per field, in order: the author's version in that language is shown and
 * offers nothing. Otherwise the original is shown, and a machine translation
 * is offered only when the original's language is known for its current text,
 * is a language (not `zxx`), differs from the reader's, and a machine row
 * written for the current text has something for the field.
 */
export function resolveTexts(
  original: OriginalTexts,
  human: HumanTexts | null,
  machine: MachineTexts | null,
  language: LanguageId
): ResolvedTexts {
  const languages = currentLanguages(original);
  const machineCurrent =
    machine !== null && machine.sourceDigest === original.textDigest;

  const resolve = (field: TextField): ResolvedField => {
    const authored = human?.[field] ?? null;
    if (authored !== null) {
      return { text: authored, language, machineTranslation: false };
    }

    const detected = languages[field];
    return {
      text: original[field],
      language: detected,
      machineTranslation:
        machineCurrent &&
        machine[field] &&
        detected !== null &&
        detected !== NOT_TRANSLATABLE &&
        detected !== language
    };
  };

  const name = resolve('name');
  const description = resolve('description');
  return {
    name,
    description,
    machineTranslation:
      name.machineTranslation || description.machineTranslation
  };
}
