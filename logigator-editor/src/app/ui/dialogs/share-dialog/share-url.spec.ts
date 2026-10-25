import { describe, expect, it } from 'vitest';
import { DEFAULT_LANGUAGE } from '@logigator/core';
import { shareDocumentUrl } from './share-url';

const LINK = '11111111-1111-4111-8111-111111111111';
const ORIGIN = window.location.origin;

describe('shareDocumentUrl', () => {
  it('lands on the document’s own page, under the sharer’s language', () => {
    // The site's page, not the editor's own `/share/{kind}/{link}` route: a
    // pasted link has to unfurl, and only the site can compose a card per
    // document.
    expect(shareDocumentUrl('de', 'project', LINK)).toBe(
      `${ORIGIN}/de/community/projects/${LINK}`
    );
  });

  it('spells the kind the way the site’s routes do', () => {
    // The API says `component`; the route segment says `components`. Handing
    // one to the other's path answers 404.
    expect(shareDocumentUrl('en', 'component', LINK)).toBe(
      `${ORIGIN}/en/community/components/${LINK}`
    );
  });

  it('falls back for a language neither app can render', () => {
    // The id travels in the `preferences` cookie, which is client-writable and
    // need not name a language the origin has — a URL carrying one the site
    // drops is a link that 404s.
    expect(shareDocumentUrl('klingon', 'project', LINK)).toBe(
      `${ORIGIN}/${DEFAULT_LANGUAGE}/community/projects/${LINK}`
    );
  });
});
