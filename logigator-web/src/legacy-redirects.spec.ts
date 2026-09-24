import { describe, expect, it } from 'vitest';
import { legacyRedirect } from './legacy-redirects';

/** `legacyRedirect` takes the query apart from the path, as the server does. */
function redirect(url: string): string | null {
  const [path, query = ''] = url.split('?');
  return legacyRedirect(path, new URLSearchParams(query));
}

const LINK = '2b6f0cc9-04d9-4d14-8d5a-8e2bb7d2b1a3';
const USER = '9d3f1a2e-11c7-4f52-9a0e-0c3d5b7e8f41';

describe('legacyRedirect', () => {
  it('leaves a path that still exists alone', () => {
    for (const path of [
      '/',
      '/examples',
      '/imprint',
      '/privacy-policy',
      '/login',
      '/register',
      '/reset-password',
      '/changelog',
      '/docs',
      '/community/projects',
      '/community/components',
      `/community/projects/${LINK}`,
      `/community/users/${USER}`,
      '/my/projects',
      '/my/components',
      '/my/account',
      `/verify-email/${LINK}`
    ]) {
      expect(redirect(path), path).toBeNull();
    }
  });

  it.each([
    ['/features', '/'],
    ['/download', '/'],
    ['/login-electron', '/login'],
    ['/my/account/profile', '/my/account'],
    ['/my/account/security', '/my/account'],
    ['/my/account/delete', '/my/account'],
    ['/auth/logout', '/login'],
    ['/auth/google-login', '/login'],
    ['/auth/google-authenticate', '/login'],
    ['/auth/twitter-login', '/login'],
    ['/auth/twitter-authenticate', '/login']
  ])('maps %s to %s', (from, to) => {
    expect(redirect(from)).toBe(to);
  });

  it.each([
    [`/community/project/${LINK}`, `/community/projects/${LINK}`],
    [`/community/component/${LINK}`, `/community/components/${LINK}`],
    [
      `/community/project/${LINK}/stargazers`,
      `/community/projects/${LINK}/stargazers`
    ],
    [
      `/community/component/${LINK}/stargazers/page`,
      `/community/components/${LINK}/stargazers`
    ],
    // Both were GETs that wrote, which is why neither survived as a URL.
    [`/community/toggleStar/project/${LINK}`, `/community/projects/${LINK}`],
    [`/community/clone/component/${LINK}`, `/community/components/${LINK}`],
    // The partials an infinite scroll fetched are the listing they filled.
    ['/community/projects/page', '/community/projects'],
    ['/my/projects/page', '/my/projects'],
    [`/my/components/info/${LINK}`, '/my/components'],
    [`/my/projects/edit-popup/${LINK}`, '/my/projects'],
    [`/my/projects/delete-popup/${LINK}`, '/my/projects'],
    [`/my/components/share-popup/${LINK}`, '/my/components'],
    ['/my/projects/create-popup', '/my/projects']
  ])('maps %s to %s', (from, to) => {
    expect(redirect(from)).toBe(to);
  });

  describe("a member's tabs, which were a query and are routes now", () => {
    it.each([
      ['', `/community/users/${USER}`],
      ['?tab=projects', `/community/users/${USER}`],
      ['?tab=components', `/community/users/${USER}/components`],
      // One `r`, as the legacy validator spelled it — and the value is what an
      // address bar holds, not the two links the legacy page drew swapped.
      ['?tab=staredProjects', `/community/users/${USER}/starred/projects`],
      ['?tab=staredComponents', `/community/users/${USER}/starred/components`]
    ])('maps /community/user/:id%s', (query, to) => {
      expect(redirect(`/community/user/${USER}${query}`)).toBe(to);
    });

    it('answers the page partial with the same page', () => {
      expect(redirect(`/community/user/${USER}/page?tab=components`)).toBe(
        `/community/users/${USER}/components`
      );
    });

    it('ignores a tab that was never one', () => {
      expect(redirect(`/community/user/${USER}?tab=nonsense`)).toBe(
        `/community/users/${USER}`
      );
    });
  });

  describe('the listing query', () => {
    it('counts pages from one, where the legacy URL counted from zero', () => {
      expect(redirect('/community/projects/page?page=0')).toBe(
        '/community/projects'
      );
      expect(redirect('/community/projects/page?page=1')).toBe(
        '/community/projects?page=2'
      );
    });

    it('carries the search term and the one ranking both sides name', () => {
      expect(
        redirect('/community/projects/page?search=adder&orderBy=latest')
      ).toBe('/community/projects?search=adder&orderBy=latest');
    });

    it('drops a parameter the new page does not read', () => {
      expect(redirect('/community/projects/page?orderBy=nonsense&x=1')).toBe(
        '/community/projects'
      );
      expect(redirect(`/community/user/${USER}?tab=components&page=3`)).toBe(
        `/community/users/${USER}/components?page=4`
      );
    });
  });

  it('answers only a path it names, so a near miss falls to the 404', () => {
    for (const path of [
      '/community/project',
      `/community/project/${LINK}/nonsense`,
      '/community/user',
      '/auth/local-login',
      '/my/projects/info',
      '/featuresx'
    ]) {
      expect(redirect(path), path).toBeNull();
    }
  });

  it('does not answer a path that would leave this origin', () => {
    expect(redirect('/community/project/..%2F..%2Fevil')).toBeNull();
    expect(redirect('/community/user/a/b')).toBeNull();
  });
});
