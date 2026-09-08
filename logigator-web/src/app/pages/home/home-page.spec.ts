import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { communityRow, EMPTY_PAGE } from '../../../testing/community-rows';
import { TranslationService } from '../../translation/translation.service';
import { HomeContentService } from './home-content.service';
import { HomePage } from './home-page';

const EXAMPLE_LINK = '11111111-1111-4111-8111-111111111111';
const PROJECT_LINK = '22222222-2222-4222-8222-222222222222';

describe('HomePage', () => {
  let http: HttpTestingController;

  /** Answers the three reads the guard makes, then renders the page. */
  async function render(answers: {
    examples?: unknown;
    projects?: unknown;
    components?: unknown;
    failComponents?: boolean;
  }): Promise<HTMLElement> {
    const content = TestBed.inject(HomeContentService);
    const resolved = content.resolve();

    http
      .expectOne((r) => r.url.includes('/users/'))
      .flush(answers.examples ?? EMPTY_PAGE);
    http
      .expectOne((r) => r.url === '/api/community/projects')
      .flush(answers.projects ?? EMPTY_PAGE);
    const components = http.expectOne(
      (r) => r.url === '/api/community/components'
    );
    if (answers.failComponents) {
      components.flush(
        { code: 'internal', message: 'boom' },
        { status: 500, statusText: 'Server Error' }
      );
    } else {
      components.flush(answers.components ?? EMPTY_PAGE);
    }
    await resolved;

    // The locale table loads through a dynamic import, and these assert on the
    // words a reader sees.
    await TestBed.inject(TranslationService).setActiveLang('en');

    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  it('opens an example in the editor, and a community row on its own page', async () => {
    const el = await render({
      examples: {
        ...EMPTY_PAGE,
        entries: [communityRow('Half Adder', EXAMPLE_LINK)]
      },
      projects: {
        ...EMPTY_PAGE,
        entries: [communityRow('8-Bit ALU', PROJECT_LINK)]
      }
    });

    const hrefs = [...el.querySelectorAll('a[lgCircuitTileLink]')].map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toEqual([
      `/editor/share/${EXAMPLE_LINK}`,
      `/en/community/projects/${PROJECT_LINK}`
    ]);
  });

  it('sends the author of a community row to their own page', async () => {
    const el = await render({
      projects: {
        ...EMPTY_PAGE,
        entries: [communityRow('8-Bit ALU', PROJECT_LINK)]
      }
    });

    const author = el.querySelector('a[lgCircuitTileAuthor]')!;
    expect(author.getAttribute('href')).toBe(
      '/en/community/users/33333333-3333-4333-8333-333333333333'
    );
    expect(author.closest('a[lgCircuitTileLink]')).toBeNull();
  });

  it('leaves the rest of the page alone when one read fails', async () => {
    const el = await render({
      projects: {
        ...EMPTY_PAGE,
        entries: [communityRow('8-Bit ALU', PROJECT_LINK)]
      },
      failComponents: true
    });

    // The failure stays in the slot the read was for; the heading and the "see
    // more" link above it came from the page, so they are still there.
    expect(el.querySelectorAll('[role=alert]')).toHaveLength(1);
    expect(el.textContent).toContain('8-Bit ALU');
    expect(el.textContent).toContain('Community Components');
  });

  it('says a list is empty rather than broken when the API answers nothing', async () => {
    const el = await render({});

    expect(el.querySelector('[role=alert]')).toBeNull();
    expect(el.textContent).toContain('No public projects yet');
    expect(el.textContent).toContain('No public components yet');
  });
});
