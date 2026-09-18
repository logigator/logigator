import { describe, expect, it } from 'vitest';
import { parseChangelog } from './changelog';

const DOCUMENT = `# Changelog

The most recent release is listed first.

## 2.1.0 — 2026-08-06

### Fixes

- Something was fixed.

## 2.0.0 — 2026-08-04

Rebuilt from the ground up.
`;

describe('parseChangelog', () => {
  it('separates the title and the intro from the releases', () => {
    const changelog = parseChangelog(DOCUMENT);

    expect(changelog.title).toBe('Changelog');
    expect(changelog.intro).toBe('The most recent release is listed first.');
    expect(changelog.releases.map((release) => release.version)).toEqual([
      '2.1.0',
      '2.0.0'
    ]);
  });

  it('gives a release the notes under its heading, and only those', () => {
    const [newest] = parseChangelog(DOCUMENT).releases;

    expect(newest.date).toBe('2026-08-06');
    expect(newest.body).toBe('### Fixes\n\n- Something was fixed.');
  });

  it('reads a document whose lines end the other way', () => {
    const changelog = parseChangelog(DOCUMENT.replaceAll('\n', '\r\n'));

    expect(changelog.title).toBe('Changelog');
    expect(changelog.releases.map((release) => release.version)).toEqual([
      '2.1.0',
      '2.0.0'
    ]);
  });

  it('rejects a second-level heading that is not a release', () => {
    expect(() =>
      parseChangelog('# Changelog\n\n## 2.1.0 - 2026-08-06\n')
    ).toThrow('2.1.0 - 2026-08-06');
    expect(() =>
      parseChangelog('# Changelog\n\n## 2.1.0 — 06.08.2026\n')
    ).toThrow();
  });

  it('leaves a first-level heading below a release to its notes', () => {
    const changelog = parseChangelog(
      '# Changelog\n\n## 2.1.0 — 2026-08-06\n\n# Not the title\n'
    );

    expect(changelog.title).toBe('Changelog');
    expect(changelog.releases[0].body).toBe('# Not the title');
  });

  it('leaves a heading inside a fenced block to the body it is written in', () => {
    const [release] = parseChangelog(
      '# Changelog\n\n## 2.1.0 — 2026-08-06\n\n```md\n## not a release\n```\n'
    ).releases;

    expect(release.body).toBe('```md\n## not a release\n```');
  });
});
