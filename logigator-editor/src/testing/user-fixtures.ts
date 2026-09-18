import type { UserResponse } from '@logigator/contract';

/**
 * A signed-in account as `GET /api/user` answers it. Only the id matters to the
 * session specs: it is what a transition and an ownership stamp compare.
 */
export function makeUser(id: string): UserResponse {
  return {
    id,
    username: id,
    email: `${id}@example.test`,
    emailVerified: true,
    avatar: null,
    memberSince: '2024-01-01T00:00:00.000Z',
    hasPassword: true,
    googleLinked: false
  };
}
