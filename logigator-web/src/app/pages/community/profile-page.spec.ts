import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import type { PublicProfile } from '@logigator/contract';
import { publicProfile } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { ProfilePage } from './profile-page';
import { ProfileService } from './profile.service';

const USER = '33333333-3333-4333-8333-333333333333';
const PROFILE_URL = `/api/community/users/${USER}`;

describe('ProfilePage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
  });

  /** Resolves the header's read — what the route's guard does — and draws it. */
  async function render(
    patch: Partial<PublicProfile> = {}
  ): Promise<HTMLElement> {
    const content = TestBed.inject(ProfileService);
    const resolved = content.resolveProfile(USER);
    http.expectOne(PROFILE_URL).flush(publicProfile({ id: USER, ...patch }));
    await resolved;

    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** The four external links the header can carry: the site and three slots. */
  const externalLinks = (root: HTMLElement): HTMLAnchorElement[] =>
    [...root.querySelectorAll('a')].filter(
      (anchor) => anchor.getAttribute('target') === '_blank'
    );

  it('names an unrecognised link by its host, never by the string stored', async () => {
    const root = await render({
      socialLinks: [
        // The shape the API refuses to store, and the one a page must never
        // print as typed: `github.com` here is a user name and the host is
        // `evil.example`.
        { url: 'https://github.com@evil.example/x', platform: 'other' }
      ]
    });

    const [link] = externalLinks(root);
    expect(link.textContent?.trim()).toBe('evil.example');
    expect(link.getAttribute('href')).toBe('https://github.com@evil.example/x');
  });

  it('vouches for none of them', async () => {
    const root = await render({
      websiteUrl: 'https://ada.example/',
      socialLinks: [
        { url: 'https://github.com/ada', platform: 'github' },
        { url: 'https://unknown.example/me', platform: 'other' }
      ]
    });

    const links = externalLinks(root);
    // The website and both slots. Nothing here verifies ownership, so every
    // one of them is `ugc` and `nofollow`, opens in a new tab, and carries the
    // `noopener noreferrer` that keeps the opened page out of this one's
    // window object.
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer ugc nofollow');
    }
    // The website is the member's own, and its text is the bare host — not the
    // address, which nobody reads.
    expect(links[0]?.textContent?.trim()).toBe('ada.example');
  });

  it('draws three identical slots three times', async () => {
    const url = 'https://github.com/ada';
    const root = await render({
      socialLinks: [
        { url, platform: 'github' },
        { url, platform: 'github' },
        { url, platform: 'github' }
      ]
    });

    // Duplicates are allowed by the contract, so the loop tracks by index: a
    // URL-trailed `@for` throws on this row rather than drawing it.
    const links = externalLinks(root);
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link.querySelector('.sr-only')?.textContent?.trim()).toBe(
        'GitHub'
      );
    }
  });

  it('leaves the header bare for a member who published nothing', async () => {
    const root = await render();

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('marek_h');
    expect(externalLinks(root)).toHaveLength(0);
  });
});
