import { describe, expect, it } from 'vitest';
import { LOCALES } from '../common/locale';
import {
  readTranslationReply,
  TRANSLATION_REPLY_JSON_SCHEMA
} from './translation-reply';
import type { TranslatedText } from './translator';

/** Keywords every strict structured-output mode accepts. */
const PORTABLE_KEYWORDS = new Set([
  'type',
  'properties',
  'required',
  'additionalProperties',
  'anyOf'
]);

function* schemaNodes(node: unknown): Generator<Record<string, unknown>> {
  if (typeof node !== 'object' || node === null) return;
  const schema = node as Record<string, unknown>;
  yield schema;
  for (const child of Object.values(
    (schema['properties'] as Record<string, unknown> | undefined) ?? {}
  )) {
    yield* schemaNodes(child);
  }
  for (const branch of (schema['anyOf'] as unknown[] | undefined) ?? []) {
    yield* schemaNodes(branch);
  }
}

describe('TRANSLATION_REPLY_JSON_SCHEMA', () => {
  it('uses only the keywords every strict mode accepts', () => {
    for (const node of schemaNodes(TRANSLATION_REPLY_JSON_SCHEMA)) {
      for (const keyword of Object.keys(node)) {
        expect(PORTABLE_KEYWORDS).toContain(keyword);
      }
    }
  });

  it('requires every property and allows no other', () => {
    const objects = [...schemaNodes(TRANSLATION_REPLY_JSON_SCHEMA)].filter(
      (node) => node['type'] === 'object'
    );
    expect(objects.length).toBeGreaterThan(0);
    for (const node of objects) {
      expect(node['additionalProperties']).toBe(false);
      expect([...(node['required'] as string[])].sort()).toEqual(
        Object.keys(node['properties'] as object).sort()
      );
    }
  });

  it('asks for an entry per site language', () => {
    const translations = (
      TRANSLATION_REPLY_JSON_SCHEMA['properties'] as Record<
        string,
        { properties: object }
      >
    )['translations'];
    expect(Object.keys(translations.properties).sort()).toEqual(
      [...LOCALES].sort()
    );
  });
});

const NONE: TranslatedText = { name: null, description: null };

function reply(
  overrides: {
    nameLanguage?: string;
    descriptionLanguage?: string;
    translations?: Partial<Record<string, TranslatedText>>;
  } = {}
): string {
  return JSON.stringify({
    nameLanguage: overrides.nameLanguage ?? 'en',
    descriptionLanguage: overrides.descriptionLanguage ?? 'en',
    translations: {
      ...Object.fromEntries(LOCALES.map((locale) => [locale, NONE])),
      ...overrides.translations
    }
  });
}

const INPUT = {
  name: 'Full Adder',
  description: 'Adds three bits.',
  hint: 'en'
};

describe('readTranslationReply', () => {
  it('keeps what changes and nothing else', () => {
    const read = readTranslationReply(
      reply({
        translations: {
          de: { name: 'Volladdierer', description: 'Addiert drei Bits.' },
          fr: { name: 'Full Adder', description: 'Additionne trois bits.' }
        }
      }),
      INPUT
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
    const read = readTranslationReply(
      reply({
        nameLanguage: 'de',
        descriptionLanguage: 'en',
        translations: {
          de: { name: 'Addierer', description: 'Addiert drei Bits.' },
          en: { name: 'Adder', description: 'Sums three bits.' }
        }
      }),
      { ...INPUT, name: 'Volladdierer' }
    );

    expect(read.ok && read.translation.texts).toEqual({
      de: { name: null, description: 'Addiert drei Bits.' },
      en: { name: 'Adder', description: null }
    });
  });

  it('offers nothing for a field with nothing to translate', () => {
    const read = readTranslationReply(
      reply({
        nameLanguage: 'zxx',
        translations: { de: { name: 'ZVE', description: null } }
      }),
      { ...INPUT, name: 'CPU' }
    );

    expect(read.ok && read.translation.texts).toEqual({});
  });

  it('marks an empty description as having no language, whatever the model said', () => {
    const read = readTranslationReply(
      reply({
        translations: { de: { name: null, description: 'Eine Schaltung.' } }
      }),
      { ...INPUT, description: '' }
    );

    expect(read.ok && read.translation.descriptionLanguage).toBe('zxx');
    expect(read.ok && read.translation.texts).toEqual({});
  });

  it('compares with the original after normalization', () => {
    const read = readTranslationReply(
      reply({
        translations: {
          de: { name: ' Full​ Adder ', description: 'Adds three bits.\r\n' }
        }
      }),
      INPUT
    );

    expect(read.ok && read.translation.texts).toEqual({});
  });

  it('drops a machine name the name column cannot hold, and only the name', () => {
    const read = readTranslationReply(
      reply({
        translations: {
          de: {
            name: 'Ein sehr langer Volladdierer',
            description: 'Addiert drei Bits.'
          }
        }
      }),
      INPUT
    );

    expect(read.ok && read.translation.texts).toEqual({
      de: { name: null, description: 'Addiert drei Bits.' }
    });
  });

  it('reads a reply wrapped in a fenced block', () => {
    const fenced = `Here you go:\n\n\`\`\`json\n${reply()}\n\`\`\`\n`;
    expect(readTranslationReply(fenced, INPUT).ok).toBe(true);
  });

  it('refuses a reply that is not JSON', () => {
    expect(readTranslationReply('Volladdierer', INPUT)).toMatchObject({
      ok: false,
      rejection: { stage: 'parse' }
    });
  });

  it('refuses a language that is not a language code', () => {
    expect(
      readTranslationReply(reply({ nameLanguage: 'English' }), INPUT)
    ).toMatchObject({ ok: false, rejection: { stage: 'schema' } });
  });

  it('refuses a reply missing a site language', () => {
    const missing = JSON.parse(reply()) as {
      translations: Record<string, unknown>;
    };
    delete missing.translations['es'];

    expect(readTranslationReply(JSON.stringify(missing), INPUT)).toMatchObject({
      ok: false,
      rejection: { stage: 'schema' }
    });
  });

  it('refuses the whole reply when one description fails the check', () => {
    const read = readTranslationReply(
      reply({
        translations: {
          de: { name: null, description: 'Addiert drei Bits.' },
          fr: {
            name: null,
            description: 'Additionne trois bits. [Plus](https://evil.example)'
          }
        }
      }),
      INPUT
    );

    expect(read).toMatchObject({ ok: false, rejection: { stage: 'check' } });
  });
});
