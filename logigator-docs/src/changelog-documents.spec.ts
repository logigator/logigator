/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Changelog, ChangelogNotes, parseChangelog } from './changelog';

const ROOT = join(import.meta.dirname, '..', '..');
const TRANSLATIONS = join(ROOT, 'changelog');

function load(lang: string): Changelog {
  const path =
    lang === 'en'
      ? join(ROOT, 'CHANGELOG.md')
      : join(TRANSLATIONS, `${lang}.md`);
  return parseChangelog(readFileSync(path, 'utf8'), lang);
}

const LANGUAGES = readdirSync(TRANSLATIONS)
  .filter((file) => file.endsWith('.md'))
  .map((file) => file.slice(0, -'.md'.length));

const ENGLISH = load('en');

/** Each section's kind and how many top-level entries it lists. */
function shape(notes: ChangelogNotes | null): string[] {
  return (notes?.sections ?? []).map(
    ({ kind, body }) => `${kind}:${body.match(/^- /gm)?.length ?? 0}`
  );
}

describe('the changelog documents', () => {
  /**
   * The version is what opens What's New and what a release tag must name, so
   * the newest release heading and the editor's version move together.
   */
  it('name the editor’s version as the newest release', () => {
    const { version } = JSON.parse(
      readFileSync(join(ROOT, 'logigator-editor', 'package.json'), 'utf8')
    ) as { version: string };

    expect(ENGLISH.releases[0].version).toBe(version);
  });

  it('link every heading of the English document', () => {
    const labels = [
      ...(ENGLISH.unreleased ? ['Unreleased'] : []),
      ...ENGLISH.releases.map((release) => release.version)
    ];

    expect(Object.keys(ENGLISH.links)).toEqual(labels);
  });

  /**
   * The documents are one history in several translations: an entry missing
   * in one language, or filed under another kind, is a translation that fell
   * behind.
   */
  it.each(LANGUAGES)('translate every entry into %s', (lang) => {
    const translated = load(lang);

    expect(
      translated.releases.map((release) => ({
        version: release.version,
        date: release.date,
        sections: shape(release)
      }))
    ).toEqual(
      ENGLISH.releases.map((release) => ({
        version: release.version,
        date: release.date,
        sections: shape(release)
      }))
    );
    expect(shape(translated.unreleased)).toEqual(shape(ENGLISH.unreleased));
  });
});
