import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { EMPTY_PAGE } from '../../../testing/community-rows';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { ProfileService, type ProfileSection } from './profile.service';

const USER = '33333333-3333-4333-8333-333333333333';
const PROFILE_URL = `/api/community/users/${USER}`;

const PROFILE = {
  id: USER,
  username: 'marek_h',
  avatar: null,
  memberSince: '2024-03-09T00:00:00.000Z',
  publicProjects: 4,
  publicComponents: 2
};

describe('ProfileService', () => {
  let http: HttpTestingController;
  let content: ProfileService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    configureTestBed();
    http = TestBed.inject(HttpTestingController);
    content = TestBed.inject(ProfileService);
  });

  /**
   * The four tabs against the four routes. The legacy template had these
   * crossed — a starred tab listing the member's own work — which is a bug only
   * a table like this catches.
   */
  it.each([
    ['projects', `${PROFILE_URL}/projects`, true],
    ['components', `${PROFILE_URL}/components`, true],
    ['starred-projects', `${PROFILE_URL}/starred/projects`, false],
    ['starred-components', `${PROFILE_URL}/starred/components`, false]
  ] as [ProfileSection, string, boolean][])(
    'reads %s from its own route',
    async (section, url, ownWork) => {
      const resolved = content.resolveListing(USER, section, 0);
      http.expectOne((request) => request.url === url).flush(EMPTY_PAGE);
      await resolved;

      expect(content.section()).toBe(section);
      // What decides whether a tile names its author: a list of the member's
      // own work says so once, above; a starred shelf is other people's.
      expect(content.ownWork()).toBe(ownWork);
    }
  );

  it('reads the member once, not again per tab', async () => {
    const resolved = content.resolveProfile(USER);
    http.expectOne(PROFILE_URL).flush(PROFILE);
    await resolved;

    const listed = content.resolveListing(USER, 'components', 0);
    http
      .expectOne((request) => request.url === `${PROFILE_URL}/components`)
      .flush(EMPTY_PAGE);
    await listed;

    expect(content.profile()?.username).toBe('marek_h');
    http.verify();
  });

  it('treats an id naming no account as the page’s own 404', async () => {
    const resolved = content.resolveProfile(USER);
    http
      .expectOne(PROFILE_URL)
      .flush(
        { code: 'not_found', message: 'No such user.' },
        { status: 404, statusText: 'Not Found' }
      );
    await resolved;

    expect(content.missing()).toBe(true);
    expect(content.failureKey()).toBeNull();
  });

  it('keeps the header standing when only the listing failed', async () => {
    // The two are resolved apart precisely so one failure does not take the
    // other down; the header is what says whose page this is.
    const profile = content.resolveProfile(USER);
    http.expectOne(PROFILE_URL).flush(PROFILE);
    await profile;

    const listed = content.resolveListing(USER, 'projects', 0);
    http
      .expectOne((request) => request.url === `${PROFILE_URL}/projects`)
      .flush(
        { code: 'service_unavailable', message: 'Postgres is unreachable.' },
        { status: 503, statusText: 'Service Unavailable' }
      );
    await listed;

    expect(content.profile()?.username).toBe('marek_h');
    expect(content.missing()).toBe(false);
    expect(content.listing.failureKey()).toBe(
      'forms.errors.serviceUnavailable'
    );
  });
});
