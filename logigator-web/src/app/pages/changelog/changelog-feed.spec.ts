import { describe, expect, it } from 'vitest';
import { Changelog } from '@logigator/docs';
import { renderChangelogFeed } from './changelog-feed';

const CHANGELOG: Changelog = {
  title: 'Changelog',
  intro: 'The most recent release is listed first.',
  releases: [
    {
      version: '2.1.0',
      date: '2026-08-06',
      body: '- Wires & junctions no longer <br> break.'
    },
    { version: '2.0.0', date: '2026-08-04', body: 'Rebuilt.' }
  ]
};

const feed = (): string =>
  renderChangelogFeed(CHANGELOG, {
    origin: 'https://logigator.com',
    lang: 'en'
  });

describe('the changelog feed', () => {
  it('is stamped with the newest release, as a date-time', () => {
    const [feedUpdated, firstEntry] =
      feed().match(/<updated>([^<]+)<\/updated>/g) ?? [];

    expect(feedUpdated).toBe('<updated>2026-08-06T00:00:00Z</updated>');
    expect(firstEntry).toBe('<updated>2026-08-06T00:00:00Z</updated>');
  });

  it('addresses a release by the heading the page gives it', () => {
    expect(feed()).toContain(
      '<id>https://logigator.com/en/changelog#2.1.0</id>'
    );
    expect(feed()).toContain(
      '<link rel="self" type="application/atom+xml" href="https://logigator.com/en/changelog.atom"/>'
    );
  });

  it('escapes the notes rather than fencing them off, markup included', () => {
    const content = /<content type="html">([\s\S]*?)<\/content>/.exec(
      feed()
    )![1];

    expect(content).not.toContain('CDATA');
    expect(content).toContain('&lt;li&gt;');
    expect(content).toContain('Wires &amp;amp; junctions');
    expect(content).toContain('&lt;br&gt;');
  });

  it('keeps the order the document lists, newest first', () => {
    const versions = [...feed().matchAll(/<title>([^<]+)<\/title>/g)].map(
      ([, title]) => title
    );

    expect(versions).toEqual(['Logigator — Changelog', '2.1.0', '2.0.0']);
  });
});
