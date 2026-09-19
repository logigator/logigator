import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { TranslationService } from '../translation/translation.service';
import { ShareControls } from './share-controls';

const SLUG = '11111111-1111-4111-8111-111111111111';
const ORIGIN = 'https://logigator.com';
const URL = `${ORIGIN}/de/share/${SLUG}`;
const CARD = `${ORIGIN}/api/share/${SLUG}/card.png`;
const COMMUNITY = `${ORIGIN}/de/community/projects/${SLUG}`;

/** Puts a member on the real `navigator`, removed again after every test. */
function install(key: 'share' | 'clipboard', value: unknown): void {
  Object.defineProperty(navigator, key, { configurable: true, value });
}

function clipboard(): { writeText: ReturnType<typeof vi.fn> } {
  const stub = { writeText: vi.fn().mockResolvedValue(undefined) };
  install('clipboard', stub);
  return stub;
}

describe('ShareControls', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  async function render(
    embedUrl?: string
  ): Promise<ComponentFixture<ShareControls>> {
    const fixture = TestBed.createComponent(ShareControls);
    fixture.componentRef.setInput('url', URL);
    fixture.componentRef.setInput('image', CARD);
    fixture.componentRef.setInput('title', 'Half adder');
    if (embedUrl !== undefined) {
      fixture.componentRef.setInput('embedUrl', embedUrl);
    }
    await TestBed.inject(TranslationService).setActiveLang('en');
    fixture.detectChanges();
    return fixture;
  }

  function button(el: HTMLElement, label: string): HTMLButtonElement {
    const found = [...el.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes(label)
    );
    expect(found, `no button labelled ${label}`).toBeDefined();
    return found!;
  }

  /** The embed block is behind a disclosure, which is what a reader sees first. */
  function snippet(el: HTMLElement): string {
    const field = el.querySelector('textarea');
    expect(field, 'the embed block is not open').not.toBeNull();
    return field!.value;
  }

  it('copies the link where the browser has no sheet to open', async () => {
    const stub = clipboard();
    const fixture = await render();

    button(fixture.nativeElement, 'Copy link').click();

    await vi.waitFor(() => expect(stub.writeText).toHaveBeenCalledWith(URL));
  });

  it('offers the sheet instead, where there is one', async () => {
    const stub = clipboard();
    const share = vi.fn().mockResolvedValue(undefined);
    install('share', share);
    const fixture = await render();

    const control = button(fixture.nativeElement, 'Share');
    control.click();

    await vi.waitFor(() =>
      expect(share).toHaveBeenCalledWith({ title: 'Half adder', url: URL })
    );
    expect(stub.writeText).not.toHaveBeenCalled();
  });

  it('builds the snippet from absolute URLs, since it is pasted elsewhere', async () => {
    // The likeliest bug in the feature: a relative `/api/...` resolves against
    // whichever site the snippet is pasted into, and nobody sees it fail until
    // a forum post renders a broken image.
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;

    button(el, 'Embed').click();
    fixture.detectChanges();

    expect(snippet(el)).toContain(CARD);
    expect(snippet(el)).toContain(URL);
  });

  it('sends an embed to the page that can rank, when there is one', async () => {
    const fixture = await render(COMMUNITY);
    const el: HTMLElement = fixture.nativeElement;

    button(el, 'Embed').click();
    fixture.detectChanges();

    // The share page is noindex, so a snippet carrying it builds link equity
    // into a URL no crawler may list.
    expect(snippet(el)).toContain(COMMUNITY);
    expect(snippet(el)).not.toContain(`](${URL})`);
  });

  it('copies the snippet it shows', async () => {
    const stub = clipboard();
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;

    button(el, 'Embed').click();
    fixture.detectChanges();
    button(el, 'Copy code').click();

    await vi.waitFor(() =>
      expect(stub.writeText).toHaveBeenCalledWith(snippet(el))
    );
  });
});
