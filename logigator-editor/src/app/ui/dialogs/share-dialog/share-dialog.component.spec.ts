import { describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import type { ProjectSummary } from '@logigator/contract';
import {
  DialogConfig,
  DialogRef,
  type LgDocumentVisibility
} from '@logigator/ui';
import { environment } from '../../../../environments/environment';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { AnalyticsService } from '../../../analytics/analytics.service';
import { AnalyticsEvent } from '../../../analytics/analytics.mapping';
import { ToastService } from '../../../logging/toast.service';
import { TranslationService } from '../../../translation/translation.service';
import {
  ShareDialogComponent,
  type ShareDialogData
} from './share-dialog.component';

const ID = '22222222-2222-4222-8222-222222222222';
const LINK = '11111111-1111-4111-8111-111111111111';
const NEW_LINK = '33333333-3333-4333-8333-333333333333';
const ORIGIN = window.location.origin;
const PATCH_URL = `${environment.apiUrl}/api/projects/${ID}`;

const DATA: ShareDialogData = {
  kind: 'project',
  projectId: ID,
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

describe('ShareDialogComponent', () => {
  let http: HttpTestingController;
  let translation: TranslationService;

  /**
   * The dialog reads its payload through `inject(DialogConfig)`, which
   * `DialogService` provides in the opened component's own injector — so the
   * spec provides it as the module's, the payload being per-test. The
   * `DialogRef` comes back to the caller, which is what watches the dialog
   * close (or not).
   */
  async function render(
    data: Partial<ShareDialogData> = {},
    lang = 'en'
  ): Promise<{
    el: HTMLElement;
    fixture: ComponentFixture<ShareDialogComponent>;
    ref: DialogRef;
  }> {
    TestBed.resetTestingModule();
    const ref = new DialogRef();
    configureTestBed([
      { provide: DialogRef, useValue: ref },
      { provide: DialogConfig, useValue: { data: { ...DATA, ...data } } }
    ]);
    http = TestBed.inject(HttpTestingController);
    translation = TestBed.inject(TranslationService);

    await translation.setActiveLang(lang);

    const fixture = TestBed.createComponent(ShareDialogComponent);
    await settle(fixture);
    return { el: fixture.nativeElement, fixture, ref };
  }

  /**
   * Renders, and lets a write inside the dialog land. `ngModel` hands its value
   * to the control accessor one pass after the component is created, and a
   * write resolves through the HTTP layer's own chain of promises — more turns
   * of the microtask queue than a spec should be counting. A macrotask drains
   * them all, and the two passes then draw what the dialog holds.
   */
  async function settle(
    fixture: ComponentFixture<ShareDialogComponent>
  ): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * The picker's segments, in the order the shared rule holds the states.
   * Scoped to the picker: the embed's format control is the same component.
   */
  function segments(el: HTMLElement): HTMLButtonElement[] {
    const picker = el.querySelector('app-visibility-picker');
    expect(picker, 'the dialog draws no visibility picker').not.toBeNull();
    return [
      ...picker!.querySelectorAll<HTMLButtonElement>('lg-select-button button')
    ];
  }

  /**
   * A control by the icon it carries rather than by its label: the labels are
   * translations, and the language bundle loads asynchronously, so a spec
   * matching on text would be asserting on keys it never waited for.
   */
  function findControl(
    el: HTMLElement,
    icon: string
  ): HTMLButtonElement | undefined {
    return [...el.querySelectorAll('button')].find(
      (candidate) => candidate.querySelector(`i.${icon}`) !== null
    );
  }

  function control(el: HTMLElement, icon: string): HTMLButtonElement {
    const found = findControl(el, icon);
    expect(found, `no button carrying ${icon}`).toBeDefined();
    return found!;
  }

  /** The footer's one control, matched on the label the dialog gives it. */
  function closeButton(el: HTMLElement): HTMLButtonElement {
    const label = translation.translate('shareDialog.close');
    const found = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
      (candidate) => candidate.textContent?.trim() === label
    );
    expect(found, 'the dialog draws no Close control').toBeDefined();
    return found!;
  }

  /**
   * The invariant the immediate model rests on: nothing in the dialog is
   * pending, so there is nothing to submit.
   */
  function expectNothingToSave(el: HTMLElement): void {
    expect(el.querySelector('form')).toBeNull();
    expect(el.querySelector('button[type="submit"]')).toBeNull();
  }

  /** Picks a state in the picker, and draws the pass that follows the click. */
  function pick(
    el: HTMLElement,
    fixture: ComponentFixture<ShareDialogComponent>,
    index: number
  ): void {
    segments(el)[index].click();
    fixture.detectChanges();
  }

  /** The field the link is read out of, where the dialog has one. */
  function linkField(el: HTMLElement): HTMLInputElement | null {
    return el.querySelector('input');
  }

  const regenerate = (el: HTMLElement) =>
    findControl(el, 'ph-arrows-clockwise');

  it('hands out the document’s own page, under the sharer’s language', async () => {
    const { el } = await render({}, 'de');

    // Not the editor's own `/share/{kind}/{link}` route: that one is a
    // destination, and a static SPA shell cannot carry a card for a pasted link.
    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/de/community/projects/${LINK}`
    );
  });

  it('re-prefixes the link when the sharer switches language', async () => {
    // The trap the URL is a `computed` for: a value captured once would keep
    // handing out a language the sharer has since left.
    const { el, fixture } = await render({}, 'en');
    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );

    await translation.setActiveLang('fr');
    fixture.detectChanges();

    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/fr/community/projects/${LINK}`
    );
  });

  it('offers no link at all while the document is private', async () => {
    const { el } = await render({ visibility: 'private' });

    // Not a disabled field and not an empty one: a private link resolves for
    // nobody, so there is no address to hand out — and the embed, which pastes
    // that same address elsewhere, has nothing to name either.
    expect(linkField(el)).toBeNull();
    expect(
      [...el.querySelectorAll('button')].some(
        (candidate) => candidate.querySelector('i.ph-code') !== null
      )
    ).toBe(false);
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
    const { el, fixture } = await render({ visibility: 'private' });

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

    expect(segments(el)[1].ariaPressed).toBe('true');
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

  it('puts the picker back, and says so, when the state is refused', async () => {
    const { el, fixture } = await render({ visibility: 'unlisted' });
    const failed = vi
      .spyOn(TestBed.inject(ToastService), 'error')
      .mockImplementation(() => undefined);

    pick(el, fixture, 0);
    http
      .expectOne(PATCH_URL)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await settle(fixture);

    // Back where the document still is, with the row that belongs to that state
    // drawn again: the picker on screen is never a state the server refused.
    expect(segments(el)[1].ariaPressed).toBe('true');
    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${LINK}`
    );
    expect(failed).toHaveBeenCalledTimes(1);
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
    const { el, fixture } = await render({ visibility: 'unlisted' });
    const capture = vi.spyOn(TestBed.inject(AnalyticsService), 'capture');

    regenerate(el)!.click();

    const request = http.expectOne(PATCH_URL);
    expect(request.request.body).toEqual({ regenerateLink: true });
    request.flush(summary('unlisted', NEW_LINK));
    await settle(fixture);

    expect(linkField(el)?.value).toBe(
      `${ORIGIN}/en/community/projects/${NEW_LINK}`
    );
    // Immediate, a revocation rather than a field: it happens as it is asked
    // for, so the event saying it happened is reported from here.
    expect(capture).toHaveBeenCalledWith(AnalyticsEvent.ShareLinkGenerated, {
      kind: 'project'
    });
  });

  it('moves to the state the server refuses in, when the link was published elsewhere', async () => {
    // The dialog was opened at `unlisted` and the document was published from
    // another tab since. The refusal is the answer to "is it still
    // unpublished?", so the picker goes where the document actually is — and
    // the link stays where it is, because the address never moved.
    const { el, fixture, ref } = await render({ visibility: 'unlisted' });
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
      translation.translate('shareDialog.linkPublished')
    );
    expect(regenerate(el)).toBeUndefined();
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

  it('names the document’s page in an embed, in every state', async () => {
    // A snippet is a link from somebody else's site, and the page a link
    // resolves to is the document's own page now — there is no second address
    // for a published document to point at instead.
    const { el, fixture } = await render({ visibility: 'public' });

    control(el, 'ph-code').click();
    fixture.detectChanges();
    const snippet = el.querySelector('textarea')?.value ?? '';

    expect(snippet).toContain(`${ORIGIN}/en/community/projects/${LINK}`);
    expect(snippet).toContain(`${ORIGIN}/api/share/project/${LINK}/card.png`);
  });
});
