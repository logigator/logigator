import { describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import type { ProjectSummary } from '@logigator/contract';
import {
  DialogConfig,
  DialogRef,
  type LgDocumentVisibility
} from '@logigator/ui';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { SITE_ORIGIN } from '../../../seo/site-origin';
import { TranslationService } from '../../../translation/translation.service';
import { MyDocumentsService } from '../my-documents.service';
import {
  ShareDocumentDialog,
  type ShareDocumentData
} from './share-document-dialog';

const ID = '22222222-2222-4222-8222-222222222222';
const LINK = '11111111-1111-4111-8111-111111111111';
const NEW_LINK = '33333333-3333-4333-8333-333333333333';
const ORIGIN = 'https://logigator.com';
const PATCH_URL = `/api/projects/${ID}`;

const DATA: ShareDocumentData = {
  kind: 'projects',
  id: ID,
  name: 'Half adder',
  link: LINK,
  visibility: 'unlisted'
};

/** The row a write answers with, in the shape the contract checks. */
function summary(
  visibility: LgDocumentVisibility,
  link = LINK
): ProjectSummary {
  return {
    id: ID,
    name: 'Half adder',
    description: '',
    visibility,
    link,
    version: 2,
    componentCount: 3,
    wireCount: 2,
    preview: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastEditedAt: '2026-01-02T00:00:00.000Z'
  };
}

describe('ShareDocumentDialog', () => {
  let http: HttpTestingController;

  /**
   * The dialog reads its payload through `inject(DialogConfig)`, which
   * `DialogService` provides in the opened component's own injector — so the
   * spec provides it as the module's, the payload being per-test. The
   * `DialogRef` comes back to the caller, which is what watches the dialog
   * close (or not).
   */
  async function render(data: Partial<ShareDocumentData> = {}): Promise<{
    el: HTMLElement;
    fixture: ComponentFixture<ShareDocumentDialog>;
    ref: DialogRef;
    shelf: MyDocumentsService;
  }> {
    TestBed.resetTestingModule();
    const ref = new DialogRef();
    configureTestBed([
      { provide: DialogRef, useValue: ref },
      { provide: DialogConfig, useValue: { data: { ...DATA, ...data } } },
      { provide: SITE_ORIGIN, useValue: ORIGIN }
    ]);
    http = TestBed.inject(HttpTestingController);

    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(ShareDocumentDialog);
    await settle(fixture);
    return {
      el: fixture.nativeElement,
      fixture,
      ref,
      shelf: TestBed.inject(MyDocumentsService)
    };
  }

  /**
   * Renders, and lets a write inside the dialog land. `ngModel` hands its value
   * to the control accessor one pass after the component is created — the
   * library's own `LgSelectButton` spec waits the same way — and a write
   * resolves through the HTTP layer's own chain of promises, which is more
   * turns of the microtask queue than a spec should be counting. A macrotask
   * drains them all, and the two passes then draw what the dialog holds.
   */
  async function settle(
    fixture: ComponentFixture<ShareDocumentDialog>
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** The picker's segments, in the order the shared rule holds the states. */
  function segments(el: HTMLElement): HTMLButtonElement[] {
    return [
      ...el.querySelectorAll<HTMLButtonElement>('lg-select-button button')
    ];
  }

  /**
   * The invariant the immediate model rests on: nothing in the dialog is
   * pending, so there is nothing to submit.
   */
  function expectNothingToSave(el: HTMLElement): void {
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('button[type="submit"]')).toBeNull();
  }

  /** The footer's one control, matched on the label the dialog gives it. */
  function closeButton(el: HTMLElement): HTMLButtonElement {
    const label = TestBed.inject(TranslationService).translate(
      'pages.my.share.close'
    );
    const found = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label
    );
    expect(found, 'the dialog draws no Close control').toBeDefined();
    return found!;
  }

  /**
   * The rotation, found by the icon it carries rather than by its label: the
   * labels are translations, so a spec matching on text asserts on words a
   * translator may reword rather than on which control it is. `undefined` where
   * the dialog draws no such control, which is itself asserted.
   */
  const regenerate = (el: HTMLElement) =>
    [...el.querySelectorAll('button')].find(
      (candidate) => candidate.querySelector('i.ph-arrows-clockwise') !== null
    );

  /** Picks a state in the picker, and draws the pass that follows the click. */
  function pick(
    el: HTMLElement,
    fixture: ComponentFixture<ShareDocumentDialog>,
    index: number
  ): void {
    segments(el)[index].click();
    fixture.detectChanges();
  }

  /** The field the link is read out of, where the dialog has one. */
  function linkField(el: HTMLElement): HTMLInputElement | null {
    return el.querySelector('input');
  }

  /**
   * A copy control of the dialog's own, which it does not draw: the share row
   * offers the clipboard and the embed together, and two of them in one panel
   * are two buttons doing one thing. Scoped to what sits outside that row,
   * whose own control is the one that stays.
   */
  function ownCopyControl(el: HTMLElement): HTMLButtonElement | undefined {
    const row = el.querySelector('web-share-controls');
    return [...el.querySelectorAll<HTMLButtonElement>('button')]
      .filter((candidate) => !row || !row.contains(candidate))
      .find((candidate) => candidate.querySelector('i.ph-copy') !== null);
  }

  it('offers no link at all while the document is private', async () => {
    const { el } = await render({ visibility: 'private' });

    // Not a disabled field and not an empty one: a private link resolves for
    // nobody, so there is no address to hand out — and the share row would be
    // offering to pass on exactly that URL.
    expect(linkField(el)).toBeNull();
    expect(el.querySelector('web-share-controls')).toBeNull();
  });

  it('shows the document’s own page as the link while it is unlisted', async () => {
    const { el } = await render({ visibility: 'unlisted' });

    // The page and the link are one address: what is copied is what a
    // recipient opens, in the language the sharer is in. The copy and the embed
    // both belong to the share row below, so the dialog draws neither.
    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
    expect(el.querySelector('web-share-controls')).not.toBeNull();
    expect(ownCopyControl(el)).toBeUndefined();
  });

  it('draws the three states in the shared order, on the state it was opened at', async () => {
    const { el } = await render({ visibility: 'unlisted' });

    expect(segments(el)).toHaveLength(3);
    expect(segments(el).map((segment) => segment.ariaPressed)).toEqual([
      'false',
      'true',
      'false'
    ]);
  });

  it('writes the state as it is picked, and has nothing to save', async () => {
    const { el, fixture, ref, shelf } = await render({ visibility: 'private' });
    const patched = vi.spyOn(shelf, 'applyPatch');
    const closing = vi.spyOn(ref, 'close');

    expectNothingToSave(el);
    pick(el, fixture, 1);

    // Immediate: the pick *is* the write, which is what lets everything under
    // the picker move with it. One intention per request, the API refusing a
    // rotation in a write that moves a published document.
    const request = http.expectOne(PATCH_URL);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ visibility: 'unlisted' });
    request.flush(summary('unlisted'));
    await settle(fixture);

    // The change is on the server as the answer lands, so the grid behind has
    // to say what the answer said — and the state the reader asked for is the
    // document's, so there is nothing left to close on.
    expect(patched).toHaveBeenCalledWith(ID, {
      visibility: 'unlisted',
      link: LINK
    });
    expect(segments(el)[1].ariaPressed).toBe('true');
    expect(closing).not.toHaveBeenCalled();
  });

  it('hands out the link the moment the state is picked, before the answer', async () => {
    // The whole point of the immediate model: a reader picking "anyone with the
    // link" wants the URL to copy there and then, and the URL is the one the
    // document has been keeping — going private did not replace it.
    const { el, fixture } = await render({ visibility: 'private' });
    expect(linkField(el)).toBeNull();

    pick(el, fixture, 1);

    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );

    http.expectOne(PATCH_URL).flush(summary('unlisted'));
    await settle(fixture);

    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
  });

  it('puts the picker back, with the reason, when the state is refused', async () => {
    const { el, fixture, ref, shelf } = await render({
      visibility: 'unlisted'
    });
    const patched = vi.spyOn(shelf, 'applyPatch');
    const closing = vi.spyOn(ref, 'close');

    pick(el, fixture, 0);
    http
      .expectOne(PATCH_URL)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    // Back where the document still is, with the row that belongs to that state
    // drawn again: the picker on screen is never a state the server refused.
    // The reason is on screen too, where the reader is looking — and named by
    // its text, because the regenerate section draws a warning banner of its
    // own further down, which a bare query for a banner would have found.
    expect(segments(el)[1].ariaPressed).toBe('true');
    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
    expect(el.querySelector('lg-message')?.textContent).toContain(
      TestBed.inject(TranslationService).translate('forms.errors.unknown')
    );
    expect(patched).not.toHaveBeenCalled();
    expect(closing).not.toHaveBeenCalled();
    expectNothingToSave(el);
  });

  it('draws no regenerate section where the link cannot be rotated', async () => {
    // A published page's address *is* its link, and a private document's is not
    // on screen at all. Neither has anything for the action to act on, so the
    // section is not drawn at all — not drawn disabled with a reason under it,
    // which is a section about something that is not possible either way.
    for (const visibility of ['private', 'public'] as const) {
      const { el } = await render({ visibility });
      expect(regenerate(el), `drawn for ${visibility}`).toBeUndefined();
    }
  });

  it('draws the regenerate section, live, while the document is unlisted', async () => {
    const { el } = await render({ visibility: 'unlisted' });

    expect(regenerate(el)?.disabled).toBe(false);
    expect(linkField(el)).not.toBeNull();
  });

  it('offers the rotation on the state the picker is on, not the one it was opened at', async () => {
    // The offer follows the pick like everything else: publishing is the one
    // state a rotation cannot act in, and it is where the picker has just gone.
    const { el, fixture } = await render({ visibility: 'unlisted' });

    pick(el, fixture, 2);

    expect(regenerate(el)).toBeUndefined();
    http.expectOne(PATCH_URL).flush(summary('public'));
    await settle(fixture);
    expect(regenerate(el)).toBeUndefined();
  });

  it('keeps the link while private, and offers the rotation on the pick that shows it', async () => {
    // The state change does not replace the link, so the URL a private document
    // is keeping is the one somebody was handed earlier. Replacing it is one
    // pick away — the state that shows it — which is what the row above names
    // rather than offering a button whose effect could not be seen.
    const { el, fixture } = await render({ visibility: 'private' });
    expect(regenerate(el)).toBeUndefined();

    pick(el, fixture, 1);
    http.expectOne(PATCH_URL).flush(summary('unlisted'));
    await settle(fixture);

    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
    expect(regenerate(el)?.disabled).toBe(false);
  });

  it('issues a new link while unlisted, and hands out the one it answered', async () => {
    const { el, fixture, ref } = await render({ visibility: 'unlisted' });
    const closing = vi.spyOn(ref, 'close');

    regenerate(el)!.click();

    const request = http.expectOne(PATCH_URL);
    expect(request.request.body).toEqual({ regenerateLink: true });
    request.flush(summary('unlisted', NEW_LINK));
    await settle(fixture);

    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${NEW_LINK}`
    );
    // The rotation is a revocation rather than a field — it happens as it is
    // asked for — so it writes with the picker untouched and the dialog stays
    // where it is for the reader to copy the link it produced.
    expect(closing).not.toHaveBeenCalled();
  });

  it('moves to the state the server refuses in, when the link was published elsewhere', async () => {
    // The dialog was opened at `unlisted` and the document was published from
    // another tab since. The refusal is the answer to "is it still
    // unpublished?", so the picker goes where the document actually is — and
    // the link stays where it is, because the address never moved.
    const { el, fixture, ref, shelf } = await render({
      visibility: 'unlisted'
    });
    const patched = vi.spyOn(shelf, 'applyPatch');
    const closing = vi.spyOn(ref, 'close');

    regenerate(el)!.click();
    http
      .expectOne(PATCH_URL)
      .flush(
        { code: 'link_published', message: 'This project is published.' },
        { status: 409, statusText: 'Conflict' }
      );
    await settle(fixture);

    expect(segments(el)[2].ariaPressed).toBe('true');
    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
    // The reason is on screen with it: the reader has just watched the state
    // move under their hands, and why the link did not move with it is exactly
    // what the message says.
    expect(el.textContent).toContain(
      TestBed.inject(TranslationService).translate(
        'pages.my.share.linkPublished'
      )
    );
    // Nothing to rotate where the document actually is, and nothing to submit:
    // the dialog stays open on the state the server reported.
    expect(regenerate(el)).toBeUndefined();
    expect(patched).toHaveBeenCalledWith(ID, { visibility: 'public' });
    expect(closing).not.toHaveBeenCalled();
  });

  it('closes on the footer’s control, having written nothing else', async () => {
    const { el, fixture, ref } = await render({ visibility: 'private' });
    const closing = vi.spyOn(ref, 'close');

    closeButton(el).click();
    fixture.detectChanges();

    expect(closing).toHaveBeenCalled();
    http.expectNone(PATCH_URL);
  });
});
