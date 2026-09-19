import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { RETURN_PATH_PARAM } from '@logigator/core';
import {
  shareComponentResponse,
  shareProjectResponse
} from '../../../testing/share-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { SITE_ORIGIN } from '../../seo/site-origin';
import { TranslationService } from '../../translation/translation.service';
import { ShareLandingPage } from './share-landing-page';
import { ShareLandingService } from './share-landing.service';

const LINK = '11111111-1111-4111-8111-111111111111';
const SHARE_URL = `/api/share/${LINK}`;
const ORIGIN = 'https://logigator.com';
const PAGE_PATH = `/en/share/${LINK}`;

type Body = ReturnType<typeof shareProjectResponse>;

describe('ShareLandingPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed([{ provide: SITE_ORIGIN, useValue: ORIGIN }]);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  async function render(
    body:
      Body | ReturnType<typeof shareComponentResponse> = shareProjectResponse(
      LINK
    ),
    fail?: { status: number; body: object }
  ): Promise<{ el: HTMLElement; detectChanges: () => void }> {
    const resolved = TestBed.inject(ShareLandingService).resolve(LINK);
    const request = http.expectOne(SHARE_URL);
    if (fail) {
      request.flush(fail.body, { status: fail.status, statusText: 'x' });
    } else {
      request.flush(body);
    }
    await resolved;

    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(ShareLandingPage);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement,
      detectChanges: () => fixture.detectChanges()
    };
  }

  function button(el: HTMLElement, label: string): HTMLButtonElement {
    const found = [...el.querySelectorAll('button')].find((candidate) =>
      candidate.textContent?.includes(label)
    );
    expect(found, `no button labelled ${label}`).toBeDefined();
    return found!;
  }

  it('draws the circuit, who made it and what it is worth', async () => {
    const { el } = await render();

    expect(el.querySelector('h1')?.textContent).toContain('Half adder');
    expect(el.textContent).toContain('marek_h');
    expect(el.textContent).toContain('12');
    expect(el.textContent).toContain('Two gates and an XOR.');
  });

  it('hands out its own address, in the language it was shared in', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    const { el } = await render();

    button(el, 'Copy link').click();

    // The prefixed form, and the site's page rather than the editor's own
    // route: this is the URL a recipient is given, and it has to unfurl.
    await vi.waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(`${ORIGIN}${PAGE_PATH}`)
    );
  });

  it('renders the site’s own 404 for a token that names nothing', async () => {
    const { el } = await render(shareProjectResponse(LINK), {
      status: 404,
      body: { code: 'not_found', message: 'No such share link.' }
    });

    // Status included — a soft 404 stays in an index, and this is exactly the
    // URL a regenerated link leaves behind.
    expect(el.querySelector('web-not-found-page')).not.toBeNull();
  });

  it('keeps the page and offers a retry when the read fails', async () => {
    const { el } = await render(shareProjectResponse(LINK), {
      status: 503,
      body: { code: 'service_unavailable', message: 'down' }
    });

    expect(el.querySelector('web-section-error')).not.toBeNull();
  });

  it('draws a component’s port surface, which a project has none of', async () => {
    const { el } = await render(shareComponentResponse(LINK));

    // Read off the tag rather than the page: `lg-tag` takes its text as an
    // input, so a projected symbol renders an empty chip and a text-content
    // assertion elsewhere on the page would not notice.
    expect(el.querySelector('lg-tag')?.textContent?.trim()).toBe('HA');
    expect(el.textContent).toContain('in');
    expect(el.textContent).toContain('out');
  });

  it('sends a signed-out reader to sign in before taking a copy', async () => {
    const { el } = await render();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockReturnValue(PAGE_PATH);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    button(el, 'Save a copy').click();

    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(['/en/login'], {
        queryParams: { [RETURN_PATH_PARAM]: PAGE_PATH }
      })
    );
    http.expectNone(`${SHARE_URL}/clone`);
  });
});
