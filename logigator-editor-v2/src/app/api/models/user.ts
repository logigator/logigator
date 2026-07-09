import type { PersistedResource } from './shared';

// ---- Shortcut ----

export interface Shortcut {
  name: string;
  keyCode: string;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
}

// ---- Profile picture ----

export type ProfilePicture = PersistedResource;

// ---- User entity (GET /api/user response) ----

export interface UserData {
  /**
   * Only with privateUserData group — and only from backends that expose it
   * (the entity gained the `@Expose` alongside the editor's session lifecycle).
   * Consumers needing a stable identity use {@link sessionUserId}, which falls
   * back to unique account fields.
   */
  id?: string;
  memberSince: string;
  username: string;
  /** Only with privateUserData group. */
  email?: string;
  image: ProfilePicture | null;
  /** Only with privateUserData group. */
  shortcuts?: Shortcut[];
  /** Only with privateUserData / extendedUserData groups. */
  projects?: unknown[];
  /** Only with privateUserData / extendedUserData groups. */
  components?: unknown[];
}

/**
 * A stable identity for the signed-in user, for session-transition and
 * document-ownership tracking: the uuid when the backend sends it, else the
 * unique account fields (`email` is unique; `username` covers responses
 * without private data).
 */
export function sessionUserId(user: UserData): string {
  return user.id ?? user.email ?? user.username;
}

// ---- PATCH /api/user request ----

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  current_password?: string;
  email?: string;
  shortcuts?: Shortcut[];
}
