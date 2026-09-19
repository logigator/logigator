import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogConfig, DialogRef } from '@logigator/ui';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { TranslationService } from '../../../translation/translation.service';
import {
  ShareDialogComponent,
  type ShareDialogData
} from './share-dialog.component';

const LINK = '11111111-1111-4111-8111-111111111111';
const ORIGIN = window.location.origin;

const DATA: ShareDialogData = {
  kind: 'project',
  projectId: '22222222-2222-4222-8222-222222222222',
  name: 'Half adder',
  link: LINK,
  isPublic: false
};

describe('ShareDialogComponent', () => {
  /**
   * The dialog reads its payload through `inject(DialogConfig)`, which
   * `DialogService` provides in the opened component's own injector — so the
   * spec provides it as the module's, the payload being per-test.
   */
  async function render(
    data: Partial<ShareDialogData> = {},
    lang = 'en'
  ): Promise<{
    el: HTMLElement;
    fixture: ComponentFixture<ShareDialogComponent>;
  }> {
    TestBed.resetTestingModule();
    configureTestBed([
      { provide: DialogRef, useValue: new DialogRef() },
      { provide: DialogConfig, useValue: { data: { ...DATA, ...data } } }
    ]);

    await TestBed.inject(TranslationService).setActiveLang(lang);

    const fixture = TestBed.createComponent(ShareDialogComponent);
    fixture.detectChanges();
    return { el: fixture.nativeElement, fixture };
  }

  /** The field a reader copies from, which is what the dialog is for. */
  function linkField(el: HTMLElement): HTMLInputElement {
    const field = el.querySelector('input');
    expect(field, 'the dialog shows no link field').not.toBeNull();
    return field!;
  }

  /**
   * A control by the icon it carries rather than by its label: the labels are
   * translations, and the language bundle loads asynchronously, so a spec
   * matching on text would be asserting on keys it never waited for.
   */
  function control(el: HTMLElement, icon: string): HTMLButtonElement {
    const found = [...el.querySelectorAll('button')].find(
      (candidate) => candidate.querySelector(`i.${icon}`) !== null
    );
    expect(found, `no button carrying ${icon}`).toBeDefined();
    return found!;
  }

  it('hands out the site’s page, under the sharer’s language', async () => {
    const { el } = await render({}, 'de');

    // Not the editor's own `/share/:link` route: that one is a destination,
    // and a static SPA shell cannot carry a card for a pasted link.
    expect(linkField(el).value).toBe(`${ORIGIN}/de/share/${LINK}`);
  });

  it('re-prefixes the link when the sharer switches language', async () => {
    // The trap the URL is a `computed` for: a value captured once would keep
    // handing out a language the sharer has since left.
    const { el, fixture } = await render({}, 'en');
    expect(linkField(el).value).toBe(`${ORIGIN}/en/share/${LINK}`);

    await TestBed.inject(TranslationService).setActiveLang('fr');
    fixture.detectChanges();

    expect(linkField(el).value).toBe(`${ORIGIN}/fr/share/${LINK}`);
  });

  it('sends an embed to the community page once the document is published', async () => {
    const { el, fixture } = await render({ isPublic: true });

    control(el, 'ph-code').click();
    fixture.detectChanges();
    const snippet = el.querySelector('textarea')?.value ?? '';

    // A snippet is a link from somebody else's site, so it should carry the
    // page that can rank rather than the one that is kept out of indexes.
    expect(snippet).toContain(`${ORIGIN}/en/community/projects/${LINK}`);
    expect(snippet).toContain(`${ORIGIN}/api/share/${LINK}/card.png`);
  });

  it('sends it to the share page while there is no community page', async () => {
    const { el, fixture } = await render({ isPublic: false });

    control(el, 'ph-code').click();
    fixture.detectChanges();
    const snippet = el.querySelector('textarea')?.value ?? '';

    expect(snippet).toContain(`${ORIGIN}/en/share/${LINK}`);
    expect(snippet).not.toContain('/community/');
  });
});
