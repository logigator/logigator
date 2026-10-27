import { describe, expect, it } from 'vitest';
import { LOCALES } from '../common/locale';
import type { ModerationVerdict } from '../moderation/moderation-verdict';
import type { TranslatedText } from '../documents/document-texts';
import {
  ANALYSIS_REPLY_JSON_SCHEMA,
  readAnalysisReply
} from './analysis-reply';
import type { AnalysisInput } from './text-analyzer';

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

describe('ANALYSIS_REPLY_JSON_SCHEMA', () => {
  it('uses only the keywords every strict mode accepts', () => {
    for (const node of schemaNodes(ANALYSIS_REPLY_JSON_SCHEMA)) {
      for (const keyword of Object.keys(node)) {
        expect(PORTABLE_KEYWORDS).toContain(keyword);
      }
    }
  });

  it('requires every property and allows no other', () => {
    const objects = [...schemaNodes(ANALYSIS_REPLY_JSON_SCHEMA)].filter(
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
      ANALYSIS_REPLY_JSON_SCHEMA['properties'] as Record<
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

const CLEAN: ModerationVerdict = { category: 'none', certain: false, note: '' };

function reply(
  overrides: {
    nameLanguage?: string;
    translations?: Partial<Record<string, TranslatedText>>;
    moderation?: Record<string, unknown>;
  } = {}
): string {
  return JSON.stringify({
    nameLanguage: overrides.nameLanguage ?? 'en',
    descriptionLanguage: 'en',
    translations: {
      ...Object.fromEntries(LOCALES.map((locale) => [locale, NONE])),
      ...overrides.translations
    },
    moderation: overrides.moderation ?? CLEAN
  });
}

const INPUT: AnalysisInput = {
  name: 'Full Adder',
  description: 'Adds three bits.',
  hint: 'en',
  versions: []
};

describe('readAnalysisReply', () => {
  it('returns the trimmed translation and the verdict', () => {
    const read = readAnalysisReply(
      reply({
        translations: {
          de: { name: 'Volladdierer', description: 'Addiert drei Bits.' },
          fr: { name: 'Full Adder', description: null }
        },
        moderation: { category: 'Spam', certain: false, note: 'An ad.' }
      }),
      INPUT
    );

    expect(read).toEqual({
      ok: true,
      translation: {
        nameLanguage: 'en',
        descriptionLanguage: 'en',
        texts: {
          de: { name: 'Volladdierer', description: 'Addiert drei Bits.' }
        }
      },
      verdict: { category: 'spam', certain: false, note: 'An ad.' }
    });
  });

  it('reads a reply wrapped in a fenced block', () => {
    const fenced = `Here you go:\n\n\`\`\`json\n${reply()}\n\`\`\`\n`;
    expect(readAnalysisReply(fenced, INPUT).ok).toBe(true);
  });

  it('refuses a reply that is not JSON', () => {
    expect(readAnalysisReply('Volladdierer', INPUT)).toMatchObject({
      ok: false,
      rejection: { stage: 'parse' }
    });
  });

  it('refuses a language that is not a language code, with no verdict', () => {
    expect(
      readAnalysisReply(reply({ nameLanguage: 'English' }), INPUT)
    ).toEqual({
      ok: false,
      rejection: expect.objectContaining({ stage: 'schema' }),
      verdict: null
    });
  });

  it('refuses a reply missing a site language', () => {
    const missing = JSON.parse(reply()) as {
      translations: Record<string, unknown>;
    };
    delete missing.translations['es'];

    expect(readAnalysisReply(JSON.stringify(missing), INPUT)).toMatchObject({
      ok: false,
      rejection: { stage: 'schema' }
    });
  });

  it('refuses the whole reply when one description fails the check', () => {
    const read = readAnalysisReply(
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

  it('returns the verdict of a reply whose translation the check refuses', () => {
    const read = readAnalysisReply(
      reply({
        translations: {
          de: {
            name: null,
            description: 'Addiert drei Bits. [Mehr](https://evil.example)'
          }
        },
        moderation: { category: 'spam', certain: true, note: 'An ad.' }
      }),
      INPUT
    );

    expect(read).toMatchObject({
      ok: false,
      rejection: { stage: 'check' },
      verdict: { category: 'spam', certain: true, note: 'An ad.' }
    });
  });

  it('refuses a category that is not one of the categories, with no verdict', () => {
    expect(
      readAnalysisReply(
        reply({ moderation: { category: 'hate', certain: true, note: '' } }),
        INPUT
      )
    ).toMatchObject({
      ok: false,
      rejection: { stage: 'schema' },
      verdict: null
    });
  });

  it('refuses a reply without a verdict', () => {
    const missing = JSON.parse(reply()) as Record<string, unknown>;
    delete missing['moderation'];

    expect(readAnalysisReply(JSON.stringify(missing), INPUT)).toMatchObject({
      ok: false,
      rejection: { stage: 'schema' }
    });
  });
});
