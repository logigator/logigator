import type { UserResponse } from '@logigator/contract';

/**
 * A signed-in account as `GET /api/user` answers it.
 *
 * Shared because the session specs all need one and the response has a fixed
 * shape they have no opinion about — only the id matters to them, since that is
 * what a session transition and a document's ownership stamp compare.
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
