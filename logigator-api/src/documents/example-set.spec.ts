import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { loadExampleSet, parseExampleManifest } from './example-set';

function manifest(project: Record<string, unknown>): unknown {
  return {
    account: { username: 'Logigator', email: 'support@logigator.com' },
    components: [],
    projects: [
      {
        slug: 'full-adder',
        id: '00000000-18b7-4ba7-a2ec-4455a7609a40',
        link: '84c816f5-3514-4c2e-a749-5b5c6c15a07b',
        language: 'en',
        name: 'Full Adder',
        description: 'Adds three bits.',
        visibility: 'public',
        createdAt: '2021-03-27T23:21:14.447Z',
        ...project
      }
    ]
  };
}

/** The paths of the issues a manifest is refused for. */
function refusedAt(value: unknown): PropertyKey[][] {
  try {
    parseExampleManifest(value);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map((issue) => issue.path);
    }
    throw error;
  }
  return [];
}

describe('parseExampleManifest', () => {
  it('keeps the original in name and description and the rest as human versions', () => {
    const [project] = parseExampleManifest(
      manifest({
        language: 'de',
        name: { en: 'Full Adder', de: 'Volladdierer', fr: 'Additionneur' },
        description: { de: 'Addiert drei Bits.', en: 'Adds three bits.' }
      })
    ).projects;

    expect(project.language).toBe('de');
    expect(project.name).toBe('Volladdierer');
    expect(project.description).toBe('Addiert drei Bits.');
    expect(project.texts).toEqual({
      en: { name: 'Full Adder', description: 'Adds three bits.' },
      fr: { name: 'Additionneur', description: null }
    });
  });

  it('reads a field written once as the original', () => {
    const [project] = parseExampleManifest(
      manifest({ name: 'CPU', description: { en: 'A CPU.', es: 'Una CPU.' } })
    ).projects;

    expect(project.name).toBe('CPU');
    expect(project.texts).toEqual({
      es: { name: null, description: 'Una CPU.' }
    });
  });

  it("refuses a field without the original's language", () => {
    expect(
      refusedAt(manifest({ name: { de: 'Volladdierer', fr: 'Additionneur' } }))
    ).toEqual([['projects', 0, 'name']]);
  });

  it('refuses a name over the length limit in any language', () => {
    expect(
      refusedAt(
        manifest({ name: { en: 'Adder', de: 'Vier-Bit-Volladdierer-Kette' } })
      )
    ).toEqual([['projects', 0, 'name', 'de']]);
  });
});

describe('loadExampleSet', () => {
  it('loads the checked-in examples', async () => {
    const set = await loadExampleSet(
      join(import.meta.dirname, '..', '..', 'examples')
    );

    for (const example of [...set.components, ...set.projects]) {
      expect(example.texts[example.language]).toBeUndefined();
    }
  });
});
