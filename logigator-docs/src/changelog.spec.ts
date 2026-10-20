import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';

const DOCUMENT = `# Changelog

The most recent release is listed first.

## [Unreleased]

### 🐛 Fixed

- Something is about to be fixed.

## [2.1.0] - 2026-08-06

### ✨ Added

- Something new.

### 🐛 Fixed

- Something was fixed.

## [2.0.0] - 2026-08-04

Rebuilt from the ground up.

### 🔄 Changed

- Everything.

[Unreleased]: https://example.com/compare/v2.1.0...HEAD
[2.1.0]: https://example.com/compare/v2.0.0...v2.1.0
[2.0.0]: https://example.com/releases/tag/v2.0.0
`;

/** A one-release document around `notes`. */
function release(notes: string): string {
  return `# Changelog\n\n## [2.1.0] - 2026-08-06\n\n${notes}\n`;
}

describe('parseChangelog', () => {
  it('separates the title and the intro from the releases', () => {
    const changelog = parseChangelog(DOCUMENT, 'en');

    expect(changelog.title).toBe('Changelog');
    expect(changelog.intro).toBe('The most recent release is listed first.');
    expect(changelog.releases.map((release) => release.version)).toEqual([
      '2.1.0',
      '2.0.0'
    ]);
  });

  it('gives a release the notes under its heading, and only those', () => {
    const [newest] = parseChangelog(DOCUMENT, 'en').releases;

    expect(newest.date).toBe('2026-08-06');
    expect(newest.body).toBe(
      '### ✨ Added\n\n- Something new.\n\n### 🐛 Fixed\n\n- Something was fixed.'
    );
    expect(newest.sections).toEqual([
      { kind: 'added', body: '- Something new.' },
      { kind: 'fixed', body: '- Something was fixed.' }
    ]);
  });

  it('keeps unreleased notes out of the releases', () => {
    const changelog = parseChangelog(DOCUMENT, 'en');

    expect(changelog.unreleased?.sections).toEqual([
      { kind: 'fixed', body: '- Something is about to be fixed.' }
    ]);
    expect(changelog.releases[0].version).toBe('2.1.0');
  });

  it('takes the headings’ link definitions out of the last release', () => {
    const changelog = parseChangelog(DOCUMENT, 'en');

    expect(changelog.releases[1].body).toBe(
      'Rebuilt from the ground up.\n\n### 🔄 Changed\n\n- Everything.'
    );
    expect(changelog.links['2.0.0']).toBe(
      'https://example.com/releases/tag/v2.0.0'
    );
    expect(Object.keys(changelog.links)).toEqual([
      'Unreleased',
      '2.1.0',
      '2.0.0'
    ]);
  });

  it('leaves a link definition that names no heading to its notes', () => {
    const [newest] = parseChangelog(
      release(
        '### ✨ Added\n\n- See [the docs].\n\n[the docs]: https://x.test'
      ),
      'en'
    ).releases;

    expect(newest.body).toContain('[the docs]: https://x.test');
  });

  it('reads a document whose lines end the other way', () => {
    const changelog = parseChangelog(DOCUMENT.replaceAll('\n', '\r\n'), 'en');

    expect(changelog.title).toBe('Changelog');
    expect(changelog.releases.map((release) => release.version)).toEqual([
      '2.1.0',
      '2.0.0'
    ]);
  });

  it('rejects a second-level heading that is not a release', () => {
    expect(() =>
      parseChangelog('# Changelog\n\n## 2.1.0 — 2026-08-06\n', 'en')
    ).toThrow('2.1.0 — 2026-08-06');
    expect(() =>
      parseChangelog('# Changelog\n\n## [2.1.0] - 06.08.2026\n', 'en')
    ).toThrow();
  });

  it('rejects [Unreleased] below a release', () => {
    expect(() =>
      parseChangelog(
        `${release('### 🐛 Fixed\n\n- A fix.')}\n## [Unreleased]\n`,
        'en'
      )
    ).toThrow('[Unreleased]');
  });

  it('rejects a section that is not a kind of change in the language', () => {
    expect(() =>
      parseChangelog(release('### Features\n\n- New.'), 'en')
    ).toThrow('### Features');
    expect(() => parseChangelog(release('### Added\n\n- New.'), 'en')).toThrow(
      '### Added'
    );
    expect(() =>
      parseChangelog(release('### ✨ Added\n\n- New.'), 'de')
    ).toThrow('### ✨ Added');
  });

  it('rejects sections out of order or repeated', () => {
    expect(() =>
      parseChangelog(
        release('### 🐛 Fixed\n\n- A.\n\n### ✨ Added\n\n- B.'),
        'en'
      )
    ).toThrow('### ✨ Added');
    expect(() =>
      parseChangelog(
        release('### 🐛 Fixed\n\n- A.\n\n### 🐛 Fixed\n\n- B.'),
        'en'
      )
    ).toThrow('### 🐛 Fixed');
  });

  it('rejects a release with no sections', () => {
    expect(() => parseChangelog(release('Just prose.'), 'en')).toThrow('2.1.0');
  });

  it('leaves a first-level heading below a release to its notes', () => {
    const changelog = parseChangelog(
      release('### ✨ Added\n\n# Not the title'),
      'en'
    );

    expect(changelog.title).toBe('Changelog');
    expect(changelog.releases[0].sections[0].body).toBe('# Not the title');
  });

  it('leaves a heading inside a fenced block to the body it is written in', () => {
    const [newest] = parseChangelog(
      release('### ✨ Added\n\n```md\n## not a release\n### Features\n```'),
      'en'
    ).releases;

    expect(newest.sections[0].body).toBe(
      '```md\n## not a release\n### Features\n```'
    );
  });
});
