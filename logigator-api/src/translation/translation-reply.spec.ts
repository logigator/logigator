import { describe, expect, it } from 'vitest';
import { LOCALES } from '../common/locale';
import type { TranslatedText } from '../documents/document-texts';
import {
  readTranslation,
  type TranslationOriginal,
  type TranslationReply
} from './translation-reply';

const NONE: TranslatedText = { name: null, description: null };

function reply(
  overrides: {
    nameLanguage?: string;
    descriptionLanguage?: string;
    translations?: Partial<Record<string, TranslatedText>>;
  } = {}
): TranslationReply {
  return {
    nameLanguage: overrides.nameLanguage ?? 'en',
    descriptionLanguage: overrides.descriptionLanguage ?? 'en',
    translations: {
      ...Object.fromEntries(LOCALES.map((locale) => [locale, NONE])),
      ...overrides.translations
    } as TranslationReply['translations']
  };
}

const ORIGINAL: TranslationOriginal = {
  name: 'Full Adder',
  description: 'Adds three bits.'
};

describe('readTranslation', () => {
  it('keeps what changes and nothing else', () => {
    const read = readTranslation(
      reply({
        translations: {
          de: { name: 'Volladdierer', description: 'Addiert drei Bits.' },
          fr: { name: 'Full Adder', description: 'Additionne trois bits.' }
        }
      }),
      ORIGINAL
    );

    expect(read).toEqual({
      ok: true,
      translation: {
        nameLanguage: 'en',
        descriptionLanguage: 'en',
        texts: {
          de: { name: 'Volladdierer', description: 'Addiert drei Bits.' },
          // The model echoed the name, which is the same as keeping it.
          fr: { name: null, description: 'Additionne trois bits.' }
        }
      }
    });
  });

  it("ignores the entry for a field's own language", () => {
    const read = readTranslation(
      reply({
        nameLanguage: 'de',
        descriptionLanguage: 'en',
        translations: {
          de: { name: 'Addierer', description: 'Addiert drei Bits.' },
          en: { name: 'Adder', description: 'Sums three bits.' }
        }
      }),
      { ...ORIGINAL, name: 'Volladdierer' }
    );

    expect(read.ok && read.translation.texts).toEqual({
      de: { name: null, description: 'Addiert drei Bits.' },
      en: { name: 'Adder', description: null }
    });
  });

  it('offers nothing for a field with nothing to translate', () => {
    const read = readTranslation(
      reply({
        nameLanguage: 'zxx',
        translations: { de: { name: 'ZVE', description: null } }
      }),
      { ...ORIGINAL, name: 'CPU' }
    );

    expect(read.ok && read.translation.texts).toEqual({});
  });

  it('marks an empty description as having no language, whatever the model said', () => {
    const read = readTranslation(
      reply({
        translations: { de: { name: null, description: 'Eine Schaltung.' } }
      }),
      { ...ORIGINAL, description: '' }
    );

    expect(read.ok && read.translation.descriptionLanguage).toBe('zxx');
    expect(read.ok && read.translation.texts).toEqual({});
  });

  it('compares with the original after normalization', () => {
    const read = readTranslation(
      reply({
        translations: {
          de: { name: ' Full​ Adder ', description: 'Adds three bits.\r\n' }
        }
      }),
      ORIGINAL
    );

    expect(read.ok && read.translation.texts).toEqual({});
  });

  it('drops a machine name the name column cannot hold, and only the name', () => {
    const read = readTranslation(
      reply({
        translations: {
          de: {
            name: 'Ein sehr langer Volladdierer',
            description: 'Addiert drei Bits.'
          }
        }
      }),
      ORIGINAL
    );

    expect(read.ok && read.translation.texts).toEqual({
      de: { name: null, description: 'Addiert drei Bits.' }
    });
  });

  it('refuses the whole translation when one description fails the check', () => {
    const read = readTranslation(
      reply({
        translations: {
          de: { name: null, description: 'Addiert drei Bits.' },
          fr: {
            name: null,
            description: 'Additionne trois bits. [Plus](https://evil.example)'
          }
        }
      }),
      ORIGINAL
    );

    expect(read).toMatchObject({
      ok: false,
      reason: expect.stringContaining('the description for fr was refused')
    });
  });
});
