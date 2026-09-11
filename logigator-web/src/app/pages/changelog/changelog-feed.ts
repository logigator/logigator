import { marked } from 'marked';
import { LanguageId } from '@logigator/core';
import { Changelog, markdownToText, releaseInstant } from '@logigator/docs';
import { escapeXml } from '../../../escape-xml';
import { pathInLanguage } from '../../translation/language-url';

/** Where a feed is served from and what it links back to. */
export interface ChangelogFeedContext {
  /** The public origin, without a trailing slash. */
  origin: string;
  /** The language this feed is written in; there is one feed per language. */
  lang: LanguageId;
}

/**
 * The changelog as an Atom feed: one entry per release, newest first, carrying
 * the release notes as rendered HTML.
 *
 * The feed's own name is the document's `# …` rather than a translation key —
 * it is generated outside the Angular app, which is where the locale table
 * lives, and the markdown is already in the language the feed is for. The
 * brand is not translated, so it is prepended as it stands.
 *
 * Every id is the URL the entry can be read at, which is the release's own
 * heading on the changelog page: the page draws those headings itself and gives
 * each the version as its `id`.
 */
export function renderChangelogFeed(
  changelog: Changelog,
  { origin, lang }: ChangelogFeedContext
): string {
  const page = `${origin}${pathInLanguage(lang, '/changelog')}`;
  const self = `${page}.atom`;
  // A document with no releases would be a broken one, but the feed still has
  // to name a time.
  const updated = changelog.releases[0]?.date ?? '1970-01-01';

  const entries = changelog.releases.flatMap((release) => {
    const url = escapeXml(`${page}#${release.version}`);
    return [
      '  <entry>',
      `    <title>${escapeXml(release.version)}</title>`,
      `    <id>${url}</id>`,
      `    <link rel="alternate" type="text/html" href="${url}"/>`,
      `    <updated>${releaseInstant(release.date)}</updated>`,
      // The notes are escaped rather than fenced in a CDATA section: a feed's
      // `content` is escaped markup, which is what `type="html"` declares.
      `    <content type="html">${escapeXml(marked.parse(release.body, { async: false }))}</content>`,
      '  </entry>'
    ];
  });

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${lang}">`,
    `  <title>Logigator — ${escapeXml(changelog.title)}</title>`,
    // The intro is markdown and is authored wrapped; a subtitle is neither.
    `  <subtitle>${escapeXml(markdownToText(changelog.intro))}</subtitle>`,
    `  <id>${escapeXml(self)}</id>`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(self)}"/>`,
    `  <link rel="alternate" type="text/html" href="${escapeXml(page)}"/>`,
    `  <updated>${releaseInstant(updated)}</updated>`,
    '  <author><name>Logigator</name></author>',
    ...entries,
    '</feed>',
    ''
  ].join('\n');
}
