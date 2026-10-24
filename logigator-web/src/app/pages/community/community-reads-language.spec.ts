import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { EXAMPLES_ACCOUNT_ID, type LanguageId } from '@logigator/core';
import { communityRow, EMPTY_PAGE } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { ExamplesContentService } from '../examples/examples-content.service';
import { HomeContentService } from '../home/home-content.service';
import { CommunityBrowseService } from './community-browse.service';
import { CommunityDocumentService } from './community-document.service';
import { ProfileService, type ProfileSection } from './profile.service';

const LINK = '11111111-1111-4111-8111-111111111111';
const USER = '33333333-3333-4333-8333-333333333333';

/**
 * Every read that shows somebody else's names and descriptions resolves them
 * for the page's language, and the page's language is the active one: a read
 * that sent none would show a German reader the English page's texts, and one
 * that sent a language it held from earlier would keep them after a switch.
 */
describe('community reads', () => {
  let http: HttpTestingController;

  /** Answers every pending read, returning the `lang` each one sent. */
  function answerAll(): Map<string, string | null> {
    const sent = new Map<string, string | null>();
    for (const request of http.match(() => true)) {
      sent.set(request.request.url, request.request.params.get('lang'));
      request.flush(
        request.request.url.endsWith(LINK)
          ? { ...communityRow('Half adder', LINK), forkedFrom: null }
          : EMPTY_PAGE
      );
    }
    return sent;
  }

  async function inLanguage(lang: LanguageId): Promise<void> {
    await TestBed.inject(TranslationService).setActiveLang(lang);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  it.each<LanguageId>(['de', 'fr'])(
    'asks for a document’s texts in the page’s language (%s)',
    async (lang) => {
      await inLanguage(lang);
      const resolved = TestBed.inject(CommunityDocumentService).resolve(
        'components',
        LINK
      );
      const sent = answerAll();
      await resolved;

      expect([...sent.values()]).toEqual([lang]);
    }
  );

  it('asks again in the new language after a switch', async () => {
    const content = TestBed.inject(CommunityDocumentService);
    await inLanguage('en');
    let resolved = content.resolve('projects', LINK);
    expect([...answerAll().values()]).toEqual(['en']);
    await resolved;

    await inLanguage('es');
    resolved = content.resolve('projects', LINK);
    expect([...answerAll().values()]).toEqual(['es']);
    await resolved;
  });

  it('resolves the community listings for the page’s language', async () => {
    await inLanguage('de');
    const resolved = TestBed.inject(CommunityBrowseService).resolve(
      'projects',
      { page: 0, search: 'adder', orderBy: 'stars' }
    );
    const sent = answerAll();
    await resolved;

    expect(sent.get('/api/community/projects')).toBe('de');
  });

  it.each<ProfileSection>([
    'projects',
    'components',
    'starred-projects',
    'starred-components'
  ])('resolves a member’s %s for the page’s language', async (section) => {
    await inLanguage('fr');
    const resolved = TestBed.inject(ProfileService).resolveListing(
      USER,
      section,
      0
    );
    const sent = answerAll();
    await resolved;

    expect([...sent.values()]).toEqual(['fr']);
  });

  it('resolves every list on the home page for the page’s language', async () => {
    await inLanguage('es');
    const resolved = TestBed.inject(HomeContentService).resolve();
    const sent = answerAll();
    await resolved;

    expect(sent.size).toBe(3);
    expect(new Set(sent.values())).toEqual(new Set(['es']));
  });

  it('resolves the examples for the page’s language', async () => {
    await inLanguage('de');
    const resolved = TestBed.inject(ExamplesContentService).resolve();
    const sent = answerAll();
    await resolved;

    expect(
      sent.get(`/api/community/users/${EXAMPLES_ACCOUNT_ID}/projects`)
    ).toBe('de');
  });
});
