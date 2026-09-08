import type { CommunityProject } from '@logigator/contract';

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
    public: true,
    link,
    version: 1,
    componentCount: 0,
    wireCount: 0,
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
