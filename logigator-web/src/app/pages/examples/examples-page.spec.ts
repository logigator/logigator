import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { communityRow, EMPTY_PAGE } from '../../../testing/community-rows';
import { environment } from '../../../environments/environment';
import { ThemingService } from '../../theming/theming.service';
import { TranslationService } from '../../translation/translation.service';
import { ExamplesContentService } from './examples-content.service';
import { ExamplesPage } from './examples-page';

const EXAMPLES_URL = `/api/community/users/${environment.exampleUserId}/projects`;

const HALF_ADDER = '11111111-1111-4111-8111-111111111111';
const FULL_ADDER = '22222222-2222-4222-8222-222222222222';

/** One render per theme, as the API's variant matrix answers a preview. */
const PREVIEW = {
  light: [
    {
      url: '/files/preview/ab/1/light-256.webp',
      width: 256,
      height: 256,
      format: 'webp' as const
    }
  ],
  dark: [
    {
      url: '/files/preview/ab/1/dark-256.webp',
      width: 256,
      height: 256,
      format: 'webp' as const
    }
  ]
};

describe('ExamplesPage', () => {
  let http: HttpTestingController;

  /** Answers the one read the guard makes, then renders the page. */
  async function render(answer?: unknown): Promise<HTMLElement> {
    const resolved = TestBed.inject(ExamplesContentService).resolve();
    const request = http.expectOne((r) => r.url === EXAMPLES_URL);
    if (answer === undefined) {
      request.flush(
        { code: 'internal', message: 'boom' },
        { status: 500, statusText: 'Server Error' }
      );
    } else {
      request.flush(answer);
    }
    await resolved;

    // The locale table loads through a dynamic import, and these assert on the
    // words a reader sees.
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(ExamplesPage);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  it('reads the whole list from the configured account', async () => {
    const resolved = TestBed.inject(ExamplesContentService).resolve();
    const request = http.expectOne((r) => r.url === EXAMPLES_URL);

    // The API caps a page at 100, and the page has no pagination: asking for
    // the cap is what makes the list it draws the whole list.
    expect(request.request.params.get('size')).toBe('100');
    request.flush(EMPTY_PAGE);
    await resolved;
  });

  it('opens an example in the editor by its share link', async () => {
    const el = await render({
      ...EMPTY_PAGE,
      entries: [communityRow('Half Adder', HALF_ADDER)]
    });

    // The share link is a capability, so the editor opens it without a
    // session; there is no page on this site to open instead.
    const action = el.querySelector('a[lgButton]')!;
    expect(action.getAttribute('href')).toBe(`/editor/share/${HALF_ADDER}`);
    expect(action.getAttribute('target')).toBe('_blank');
    // Every row's label reads the same, so the link is named by its example —
    // otherwise a screen reader lists six identical destinations.
    expect(action.getAttribute('aria-label')).toContain('Half Adder');
    // A circuit that has never been saved from the editor has no render, and
    // an <img> with nothing to load is a broken-image icon in the frame.
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('picture')).toBeNull();
  });

  it('shows the description with the line breaks its author wrote', async () => {
    const el = await render({
      ...EMPTY_PAGE,
      entries: [
        communityRow('Half Adder', HALF_ADDER, {
          description: 'A half adder adds two bits.\nCarry is the overflow.'
        })
      ]
    });

    expect(el.querySelector('article p')!.textContent?.trim()).toBe(
      'A half adder adds two bits.\nCarry is the overflow.'
    );
  });

  it('draws one preview per row, from the active theme alone', async () => {
    TestBed.inject(ThemingService).setTheme('light');
    const el = await render({
      ...EMPTY_PAGE,
      entries: [
        communityRow('Half Adder', HALF_ADDER, { preview: PREVIEW }),
        communityRow('Full Adder', FULL_ADDER, { preview: PREVIEW })
      ]
    });

    // Two images, not four: the other theme's render hidden by CSS would be
    // downloaded for nothing.
    const images = [...el.querySelectorAll('img')];
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      PREVIEW.light[0].url,
      PREVIEW.light[0].url
    ]);
    // The first frame is above the fold; the rest wait for the scroll.
    expect(images[0].getAttribute('loading')).toBe('eager');
    expect(images[1].getAttribute('loading')).toBe('lazy');
  });

  it('keeps the page when the read fails, and offers a retry', async () => {
    const el = await render();

    // Heading and lede came from the page, not the API, so they survive; the
    // failure stays in the list's slot.
    expect(el.textContent).toContain('Example Circuits');
    expect(el.querySelectorAll('[role=alert]')).toHaveLength(1);
    expect(el.querySelector('article')).toBeNull();
  });

  it('says the list is empty rather than broken when the API answers nothing', async () => {
    const el = await render(EMPTY_PAGE);

    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(el.textContent).toContain('No examples yet');
  });
});
