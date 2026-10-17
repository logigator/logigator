import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import {
  communityComponentRow,
  communityRow,
  EMPTY_PAGE
} from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { TranslationService } from '../../translation/translation.service';
import { ProfileListing } from './profile-listing';
import { ProfileService, type ProfileSection } from './profile.service';

const USER = '33333333-3333-4333-8333-333333333333';
const LINK = '22222222-2222-4222-8222-222222222222';

describe('ProfileListing', () => {
  let http: HttpTestingController;

  async function render(
    section: ProfileSection,
    answer: object = { ...EMPTY_PAGE, entries: [communityRow('ALU', LINK)] }
  ): Promise<HTMLElement> {
    const resolved = TestBed.inject(ProfileService).resolveListing(
      USER,
      section,
      0
    );
    http
      .expectOne((request) => request.url.startsWith('/api/community/users/'))
      .flush(answer);
    await resolved;

    await TestBed.inject(TranslationService).setActiveLang('en');
    const fixture = TestBed.createComponent(ProfileListing);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function hrefs(el: HTMLElement): (string | null)[] {
    return [...el.querySelectorAll('a')].map((link) =>
      link.getAttribute('href')
    );
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  /**
   * A tile names its author only where the rows do not all share one: the
   * member's own work says so once in the header above, while their starred
   * shelf is other people's and each row has to say whose.
   */
  it('says nothing about the author on a member’s own work', async () => {
    const el = await render('projects');

    expect(hrefs(el)).toContain(`/en/community/projects/${LINK}`);
    expect(hrefs(el)).not.toContain(`/en/community/users/${USER}`);
  });

  it('names the author of every row on a starred shelf', async () => {
    const el = await render('starred-projects');

    expect(hrefs(el)).toContain(`/en/community/users/${USER}`);
    expect(el.textContent).toContain('marek_h');
  });

  /**
   * Which table a row came from is the section, not something on the row —
   * getting it from the row is what crossed the legacy template's links.
   */
  it('sends a component row to the component listing, not the project one', async () => {
    const el = await render('starred-components', {
      ...EMPTY_PAGE,
      entries: [communityComponentRow('Half adder', LINK)]
    });

    expect(hrefs(el)).toContain(`/en/community/components/${LINK}`);
  });

  it('says an empty tab is empty in its own words, and offers nothing', async () => {
    const el = await render('starred-components', EMPTY_PAGE);

    expect(el.textContent).toContain('No starred components');
    // Somebody else's empty list: a statement, no action, no invitation.
    expect(el.querySelector('button')).toBeNull();
  });
});
