import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE } from '@logigator/core';
import { communityDocumentUrl, shareLandingUrl } from './share-url';

const LINK = '11111111-1111-4111-8111-111111111111';
const ORIGIN = window.location.origin;

describe('shareLandingUrl', () => {
  it('lands on the site, under the language the sharer is reading in', () => {
    // The site's page, not the editor's own `/share/:link` route: a pasted link
    // has to unfurl, and only the site can compose a card per document.
    expect(shareLandingUrl('de', LINK)).toBe(`${ORIGIN}/de/share/${LINK}`);
  });

  it('falls back for a language neither app can render', () => {
    // The id travels in the `preferences` cookie, which is client-writable and
    // need not name a language the origin has — a URL carrying one the site
    // drops is a link that 404s.
    expect(shareLandingUrl('klingon', LINK)).toBe(
      `${ORIGIN}/${DEFAULT_LANGUAGE}/share/${LINK}`
    );
  });
});

describe('communityDocumentUrl', () => {
  it('spells the table the way the site’s routes do', () => {
    // The API says `component`; the route segment says `components`. Handing
    // one to the other's path answers 404.
    expect(communityDocumentUrl('en', 'component', LINK)).toBe(
      `${ORIGIN}/en/community/components/${LINK}`
    );
    expect(communityDocumentUrl('en', 'project', LINK)).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
  });
});
