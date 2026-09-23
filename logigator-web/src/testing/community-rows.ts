import type {
  CommunityComponent,
  CommunityProject,
  PublicProfile
} from '@logigator/contract';

/** An empty page envelope, which is what an unseeded deployment answers. */
export const EMPTY_PAGE = { entries: [], page: 0, pageSize: 4, total: 0 };

/**
 * One community listing row. The ids are real uuids because the contract's
 * schemas check them, and a response the boundary rejects is a failed read.
 */
export function communityRow(
  name: string,
  link: string,
  patch: Partial<CommunityProject> = {}
): CommunityProject {
  return {
    id: link,
    name,
    description: '',
    // Published and not empty, which is what a listing row is: the community
    // queries list nothing else.
    visibility: 'public',
    link,
    version: 1,
    componentCount: 4,
    wireCount: 2,
    preview: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastEditedAt: '2026-01-01T00:00:00.000Z',
    author: {
      id: '33333333-3333-4333-8333-333333333333',
      username: 'marek_h',
      avatar: null
    },
    stars: 12,
    starred: false,
    ...patch
  };
}

/**
 * The same row from the other table. A component answers with its port surface
 * too, and the boundary rejects a response without it — so a spec that reuses
 * the project row for a component listing tests a failed read.
 */
export function communityComponentRow(
  name: string,
  link: string,
  patch: Partial<CommunityComponent> = {}
): CommunityComponent {
  return {
    ...communityRow(name, link),
    symbol: 'HA',
    numInputs: 2,
    numOutputs: 2,
    labels: ['A', 'B', 'S', 'C'],
    ...patch
  };
}

/**
 * One public profile, as `GET /api/community/users/:id` answers. Beside the
 * listing rows for the reason they are here: the contract checks the uuids and
 * the dates, so a hand-written object is a read that fails at the boundary.
 */
export function publicProfile(
  patch: Partial<PublicProfile> = {}
): PublicProfile {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'marek_h',
    avatar: null,
    // A member who published nothing about themselves, which is what every
    // account starts as — a spec that wants a bio or a link patches one in.
    bio: '',
    websiteUrl: null,
    socialLinks: [],
    memberSince: '2024-03-09T00:00:00.000Z',
    publicProjects: 4,
    publicComponents: 2,
    stars: 12,
    ...patch
  };
}
