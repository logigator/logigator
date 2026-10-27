import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLATFORM_ID, TransferState } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RETURN_PATH_PARAM } from '@logigator/core';
import { DialogService } from '@logigator/ui';
import { communityRow } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { SessionService } from '../../user/session.service';
import { CommunityDocumentPage } from './community-document-page';
import { CommunityDocumentService } from './community-document.service';
import { ReportDocumentDialog } from './report-document-dialog';

const LINK = '11111111-1111-4111-8111-111111111111';
const DETAIL_URL = `/api/community/projects/${LINK}`;
const PAGE_PATH = `/en/community/projects/${LINK}`;
const TRANSLATION_PATH = `/api/community/projects/${LINK}/translation/`;

/**
 * The flag `@angular/build` defines for the server bundle; see
 * `verify-email-page.spec.ts`.
 */
declare global {
  var ngServerMode: boolean | undefined;
}

/** A German original, read on the English page. */
const GERMAN = {
  name: 'Halbaddierer',
  description: 'Addiert **zwei** Bits und gibt den Übertrag aus.',
  textLanguage: { name: 'de', description: 'de' },
  machineTranslation: true
};

/** What the translation endpoint answers for it. */
const MACHINE = {
  language: 'en',
  name: 'Half adder, by machine',
  description: 'Adds **two** bits, by machine, and outputs the carry.',
  sourceLanguage: { name: 'de', description: 'de' }
};

describe('CommunityDocumentPage', () => {
  let http: HttpTestingController;

  async function render(
    patch: Record<string, unknown> = {},
    fail?: { status: number; body: object }
  ): Promise<{
    el: HTMLElement;
    detectChanges: () => void;
    fixture: ComponentFixture<CommunityDocumentPage>;
  }> {
    const resolved = TestBed.inject(CommunityDocumentService).resolve(
      'projects',
      LINK
    );
    const request = http.expectOne((request) => request.url === DETAIL_URL);
    if (fail) {
      request.flush(fail.body, { status: fail.status, statusText: 'x' });
    } else {
      request.flush({
        ...communityRow('Half adder', LINK, patch),
        forkedFrom: null
      });
    }
    await resolved;

    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(CommunityDocumentPage);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement,
      detectChanges: () => fixture.detectChanges(),
      fixture
    };
  }

  function button(el: HTMLElement, label: string): HTMLButtonElement {
    const found = [...el.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes(label)
    );
    expect(found, `no button labelled ${label}`).toBeDefined();
    return found!;
  }

  /**
   * The star control, by the icon it carries: its label is one of two words
   * depending on the state, and a page that has no star control at all must be
   * able to say so rather than fail on a missing label.
   */
  function starControl(el: HTMLElement): HTMLButtonElement | null {
    return (
      [...el.querySelectorAll('button')].find(
        (candidate) => candidate.querySelector('web-star-icon') !== null
      ) ?? null
    );
  }

  /**
   * Puts the router on this page and intercepts where it goes next. Reading
   * `router.url` rather than navigating for real: activating the route would
   * run its guard, and the request that guard makes is the one the spec has
   * already answered by hand.
   */
  function onThisPage(): ReturnType<typeof vi.spyOn> {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue(PAGE_PATH);
    return vi.spyOn(router, 'navigate').mockResolvedValue(true);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * A visitor who wants to star has to sign in first, and has to come back to
   * the circuit they were looking at — a redirect home would make them find it
   * again, which is the whole point of the return path.
   */
  it('sends a signed-out reader to sign in, and back here afterwards', async () => {
    const { el } = await render();
    const navigate = onThisPage();

    button(el, 'Star').click();

    expect(navigate).toHaveBeenCalledWith(['/en/login'], {
      queryParams: { [RETURN_PATH_PARAM]: PAGE_PATH }
    });
    // No request went out: a star with no session is a 401, not a state.
    http.expectNone(`${DETAIL_URL}/star`);
  });

  it('sends a signed-out reader to sign in before cloning too', async () => {
    const { el } = await render();
    const navigate = onThisPage();

    button(el, 'Save a copy').click();

    expect(navigate).toHaveBeenCalledWith(['/en/login'], {
      queryParams: { [RETURN_PATH_PARAM]: PAGE_PATH }
    });
    http.expectNone(`/api/share/project/${LINK}/clone`);
  });

  it('stars for a signed-in reader and shows the count the server returned', async () => {
    const { el, detectChanges } = await render({ stars: 12, starred: false });
    TestBed.inject(SessionService).signedIn({
      id: 'a',
      username: 'ada'
    } as never);
    detectChanges();

    button(el, 'Star').click();
    http.expectOne(`${DETAIL_URL}/star`).flush({ starred: true, stars: 13 });
    await Promise.resolve();
    detectChanges();

    expect(el.textContent).toContain('Starred');
    expect(el.textContent).toContain('13');
  });

  /**
   * The two controls sit beside each other, so what is in flight has to be
   * *which* action rather than whether one is — a shared boolean spins the
   * button the reader did not press.
   */
  it('busies only the control that was pressed', async () => {
    const { el, detectChanges } = await render();
    TestBed.inject(SessionService).signedIn({
      id: 'a',
      username: 'ada'
    } as never);
    detectChanges();

    button(el, 'Star').click();
    detectChanges();

    expect(button(el, 'Star').disabled).toBe(true);
    expect(button(el, 'Save a copy').disabled).toBe(false);

    http.expectOne(`${DETAIL_URL}/star`).flush({ starred: true, stars: 1 });
    await Promise.resolve();
    detectChanges();
    expect(button(el, 'Starred').disabled).toBe(false);
  });

  /**
   * A share token that was regenerated leaves exactly this URL behind, so the
   * page is a real 404 rather than a section that failed — a soft 404 stays
   * indexed, and a crawler has no other way to learn the URL is dead.
   */
  /**
   * The three states are one page at one URL, so what separates them is what
   * the page draws: a listed document is left to the community it is in, and
   * the two that are not listed say so — the chip is the only thing
   * reconciling an address that looks like any other with a document the
   * listing does not contain.
   */
  it('leaves a published document to the community it is listed in', async () => {
    const { el } = await render({ visibility: 'public' });

    expect(el.querySelector('web-visibility-tag')).toBeNull();
    expect(starControl(el)).not.toBeNull();
    expect(el.textContent).toContain('Stargazers');
  });

  /**
   * The one published state the page has to explain: the community lists
   * nothing empty, so an owner who picked "Everyone" finds the document in no
   * listing. Only they are told — to anybody else it is an ordinary page — and
   * only while it is empty.
   */
  it('tells the owner alone that an empty published document is not listed', async () => {
    const EMPTY_NOTICE = 'isn’t listed in the community yet';
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render({
      componentCount: 0,
      wireCount: 0
    });

    expect(el.textContent).not.toContain(EMPTY_NOTICE);

    const session = TestBed.inject(SessionService);
    session.signedIn({ id: 'someone-else', username: 'ada' } as never);
    detectChanges();
    expect(el.textContent).not.toContain(EMPTY_NOTICE);

    session.signedIn({ id: owner.id, username: owner.username } as never);
    detectChanges();
    expect(el.textContent).toContain(EMPTY_NOTICE);
  });

  /**
   * The other published state the chip cannot explain: a text not yet checked
   * is in no listing either, for a few minutes. Told to the owner alone, and
   * not over the empty notice, whose reason outlasts the check.
   */
  it('tells the owner alone that a published text is still being checked', async () => {
    const CHECK_NOTICE = 'is being checked before it appears in the community';
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render({ awaitingCheck: true });

    expect(el.textContent).not.toContain(CHECK_NOTICE);

    const session = TestBed.inject(SessionService);
    session.signedIn({ id: 'someone-else', username: 'ada' } as never);
    detectChanges();
    expect(el.textContent).not.toContain(CHECK_NOTICE);

    session.signedIn({ id: owner.id, username: owner.username } as never);
    detectChanges();
    expect(el.textContent).toContain(CHECK_NOTICE);
  });

  it('names emptiness, not the check, to the owner of an empty unchecked document', async () => {
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render({
      awaitingCheck: true,
      componentCount: 0,
      wireCount: 0
    });
    TestBed.inject(SessionService).signedIn({
      id: owner.id,
      username: owner.username
    } as never);
    detectChanges();

    expect(el.textContent).toContain('isn’t listed in the community yet');
    expect(el.textContent).not.toContain('is being checked');
  });

  it('says nothing about a check of an unlisted document', async () => {
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render({
      awaitingCheck: true,
      visibility: 'unlisted'
    });
    TestBed.inject(SessionService).signedIn({
      id: owner.id,
      username: owner.username
    } as never);
    detectChanges();

    // It is in no listing for its visibility, which the chip already says.
    expect(el.textContent).not.toContain('is being checked');
  });

  it('says nothing about listing to the owner of a document with content', async () => {
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render({ componentCount: 0 });
    TestBed.inject(SessionService).signedIn({
      id: owner.id,
      username: owner.username
    } as never);
    detectChanges();

    // Wires alone are content: the rule is "empty", as the API's is.
    expect(el.textContent).not.toContain('isn’t listed in the community yet');
  });

  it('states an unlisted document’s state and drops every star affordance', async () => {
    const { el } = await render({ visibility: 'unlisted' });

    // Starring is about a listing, and the API answers for the starred set
    // with the same predicate the listings use — so a star control here would
    // offer an action the server refuses.
    expect(el.querySelector('web-visibility-tag')).not.toBeNull();
    expect(starControl(el)).toBeNull();
    expect(el.textContent).not.toContain('Stargazers');

    // The link still works, so it is still worth handing on.
    expect(el.querySelector('web-share-controls')).not.toBeNull();
  });

  it('renders the owner’s private document without a way to pass it on', async () => {
    const { el } = await render({ visibility: 'private' });

    expect(el.querySelector('web-visibility-tag')).not.toBeNull();
    expect(starControl(el)).toBeNull();

    // Nothing resolves the link but its owner, so a share sheet or an embed
    // snippet would be offering to pass on a URL that opens nothing.
    expect(el.querySelector('web-share-controls')).toBeNull();
  });

  it('tells the owner of a hidden document why, and offers nothing a listing has', async () => {
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render({
      hidden: {
        at: '2026-02-01T00:00:00.000Z',
        reason: 'Copyright notice',
        automatic: false,
        category: null
      }
    });
    TestBed.inject(SessionService).signedIn({
      id: owner.id,
      username: owner.username
    } as never);
    detectChanges();

    const notice = el.querySelector('lg-message')?.textContent ?? '';
    expect(notice).toContain('Copyright notice');
    // A moderator's hide is the person's decision already.
    expect(notice).not.toContain('A person will review');
    // Public by its own state, yet resolvable by nobody else: no star, no
    // stargazers, and no link worth handing on.
    expect(starControl(el)).toBeNull();
    expect(el.textContent).not.toContain('Stargazers');
    expect(el.querySelector('web-share-controls')).toBeNull();
  });

  it('names an automatic hide’s category and says a person reviews it, where a moderator’s hide gives its reason', async () => {
    const owner = communityRow('Half adder', LINK).author;
    const translation = TestBed.inject(TranslationService);
    const { el, detectChanges } = await render({
      hidden: {
        at: '2026-02-01T00:00:00.000Z',
        reason: '',
        automatic: true,
        category: 'harassment'
      }
    });
    TestBed.inject(SessionService).signedIn({
      id: owner.id,
      username: owner.username
    } as never);
    detectChanges();

    const notice = el.querySelector('lg-message')?.textContent ?? '';
    // The category in the reader's language, by the report form's own label.
    expect(notice).toContain(
      translation.translate('pages.community.report.reasons.harassment')
    );
    expect(notice).toContain('A person will review');
    expect(notice).not.toContain('hidden by moderation');
  });

  it('offers a report to every reader but the owner', async () => {
    const owner = communityRow('Half adder', LINK).author;
    const { el, detectChanges } = await render();
    const open = vi
      .spyOn(TestBed.inject(DialogService), 'open')
      .mockReturnValue(undefined as never);

    button(el, 'Report').click();
    expect(open).toHaveBeenCalledWith(
      ReportDocumentDialog,
      expect.objectContaining({ data: { kind: 'projects', link: LINK } })
    );

    TestBed.inject(SessionService).signedIn({
      id: owner.id,
      username: owner.username
    } as never);
    detectChanges();
    expect(
      [...el.querySelectorAll('button')].some((candidate) =>
        candidate.textContent?.includes('Report')
      )
    ).toBe(false);
  });

  it('renders the site’s 404 for a link that names nothing this reader may open', async () => {
    const { el } = await render(
      {},
      { status: 404, body: { code: 'not_found', message: 'gone' } }
    );

    expect(el.textContent).toContain('404');
    expect(el.querySelector('h1')?.textContent).toContain('Page not found');
  });

  it('keeps the page with a retry when the read failed for another reason', async () => {
    const { el } = await render(
      {},
      {
        status: 503,
        body: { code: 'service_unavailable', message: 'down' }
      }
    );

    expect(el.textContent).not.toContain('404');
    expect(el.querySelector('[role=alert]')).not.toBeNull();
    expect(el.textContent).toContain('Retry');
  });

  it('names the parent a fork was built on, and links its page', async () => {
    const parent = '22222222-2222-4222-8222-222222222222';
    const resolved = TestBed.inject(CommunityDocumentService).resolve(
      'projects',
      LINK
    );
    http
      .expectOne((request) => request.url === DETAIL_URL)
      .flush({
        ...communityRow('Half adder', LINK),
        forkedFrom: {
          id: parent,
          name: 'Adder',
          link: parent,
          authorName: 'ada'
        }
      });
    await resolved;
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(CommunityDocumentPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    // Named even where the parent is no longer public: withholding the credit
    // because somebody unpublished would turn a fork into original work.
    expect(el.textContent).toContain('Forked from');
    expect(
      [...el.querySelectorAll('a')].map((link) => link.getAttribute('href'))
    ).toContain(`/en/community/projects/${parent}`);
  });

  describe('texts in another language', () => {
    function heading(el: HTMLElement): HTMLElement {
      return el.querySelector('h1')!;
    }

    function description(el: HTMLElement): HTMLElement | null {
      return el.querySelector('lg-markdown')?.parentElement ?? null;
    }

    /** By its icon: the label is a locale's, the control is the page's. */
    function translateButton(el: HTMLElement): HTMLButtonElement | null {
      return el.querySelector('.ph-translate')?.closest('button') ?? null;
    }

    /** The one control the note carries once the machine text is shown. */
    function showOriginalButton(el: HTMLElement): HTMLButtonElement | null {
      const live = el.querySelector('[aria-live]');
      return live && !translateButton(el) ? live.querySelector('button') : null;
    }

    async function settle(
      fixture: ComponentFixture<CommunityDocumentPage>
    ): Promise<void> {
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it.each([
      // Unknown, or nothing to translate: the page's own language stands.
      [{ name: null, description: null }, null, null],
      [{ name: 'zxx', description: 'zxx' }, null, null],
      // The page's own language needs saying no more than it already is.
      [{ name: 'en', description: 'en' }, null, null],
      // Any language, not only one the site is written in.
      [{ name: 'zxx', description: 'it' }, null, 'it'],
      [{ name: 'de', description: 'zxx' }, 'de', null]
    ])(
      'tags each text with its language only where it is a different, real one (%o)',
      async (textLanguage, nameLang, descriptionLang) => {
        const { el } = await render({
          description: 'Some text.',
          textLanguage
        });

        expect(heading(el).getAttribute('lang')).toBe(nameLang);
        expect(description(el)?.getAttribute('lang')).toBe(descriptionLang);
      }
    );

    it.each([false, true])(
      'offers a translation exactly where the read flags one (%s)',
      async (machineTranslation) => {
        const { el } = await render({ ...GERMAN, machineTranslation });

        expect(translateButton(el) !== null).toBe(machineTranslation);
        // Offering is not fetching: the text comes on the click alone.
        expect(
          http.match((request) => request.url.startsWith(TRANSLATION_PATH))
        ).toEqual([]);
      }
    );

    it.each([
      [GERMAN, true],
      // The API keeps no machine text for a description in the page's language.
      [{ ...GERMAN, textLanguage: { name: 'de', description: 'en' } }, false],
      [{ ...GERMAN, textLanguage: { name: 'de', description: 'zxx' } }, false],
      [{ ...GERMAN, description: '' }, false]
    ])(
      'offers it by the description only where that can be translated (%o)',
      async (read, offered) => {
        const { el } = await render(read);
        const about = el.querySelector('section h2')!.parentElement!;

        expect(about.querySelector('.ph-translate') !== null).toBe(offered);
        expect(translateButton(el)).not.toBeNull();
      }
    );

    it('swaps the machine text in and restores the original exactly', async () => {
      const { el, fixture } = await render(GERMAN);
      await settle(fixture);
      const originalHeading = heading(el).outerHTML;
      const originalDescription = description(el)?.outerHTML;
      expect(heading(el).getAttribute('lang')).toBe('de');

      translateButton(el)!.click();
      const request = http.expectOne(
        (candidate) => candidate.url === `${TRANSLATION_PATH}en`
      );
      request.flush(MACHINE);
      await settle(fixture);

      expect(heading(el).textContent?.trim()).toBe(MACHINE.name);
      expect(description(el)?.textContent).toContain('by machine');
      expect(description(el)?.textContent).not.toContain('Übertrag');
      // The shown text is the page's language now, so it inherits the page's.
      expect(heading(el).hasAttribute('lang')).toBe(false);
      expect(description(el)?.hasAttribute('lang')).toBe(false);

      showOriginalButton(el)!.click();
      await settle(fixture);

      expect(heading(el).outerHTML).toBe(originalHeading);
      expect(description(el)?.outerHTML).toBe(originalDescription);
      expect(translateButton(el)).not.toBeNull();
    });

    it('swaps only the fields the translation answered', async () => {
      const { el, fixture } = await render(GERMAN);

      translateButton(el)!.click();
      http
        .expectOne((candidate) => candidate.url.startsWith(TRANSLATION_PATH))
        .flush({ ...MACHINE, name: null });
      await settle(fixture);

      expect(heading(el).textContent?.trim()).toBe(GERMAN.name);
      expect(heading(el).getAttribute('lang')).toBe('de');
      expect(description(el)?.textContent).toContain('by machine');
      expect(description(el)?.hasAttribute('lang')).toBe(false);
    });

    it('keeps the original and says so when the translation cannot be fetched', async () => {
      const { el, fixture } = await render(GERMAN);

      translateButton(el)!.click();
      http
        .expectOne((candidate) => candidate.url.startsWith(TRANSLATION_PATH))
        .flush(
          { code: 'service_unavailable', message: 'down' },
          { status: 503, statusText: 'Service Unavailable' }
        );
      await settle(fixture);

      expect(el.querySelector('[role=alert]')).not.toBeNull();
      expect(heading(el).textContent?.trim()).toBe(GERMAN.name);
      expect(translateButton(el)).not.toBeNull();
    });
  });

  describe('during a server render', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      configureTestBed([{ provide: PLATFORM_ID, useValue: 'server' }]);
      http = TestBed.inject(HttpTestingController);
      globalThis.ngServerMode = true;
    });

    afterEach(() => {
      globalThis.ngServerMode = undefined;
    });

    /**
     * Every server read reaches the browser inside the HTML, so whatever the
     * render holds a crawler reads. The machine text has to be in neither the
     * markup nor the transfer state — even where the button is pressed before
     * hydration.
     */
    it('carries neither the machine text nor anything holding it', async () => {
      const { el, fixture } = await render(GERMAN);
      el.querySelector('.ph-translate')?.closest('button')?.click();
      await fixture.whenStable();

      // Answered rather than left pending, so a render that did ask would put
      // the text where the assertions below look for it.
      const asked = http.match((request) =>
        request.url.startsWith(TRANSLATION_PATH)
      );
      for (const request of asked) request.flush(MACHINE);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(asked).toEqual([]);

      const state = TestBed.inject(TransferState).toJson();
      // The read itself does cross, flag and all.
      expect(state).toContain(GERMAN.name);
      expect(state).toContain('machineTranslation');
      for (const page of [state, el.outerHTML]) {
        expect(page).not.toContain('by machine');
        expect(page).not.toContain('sourceLanguage');
      }
    });
  });
});
