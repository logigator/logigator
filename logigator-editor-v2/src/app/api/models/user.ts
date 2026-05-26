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
	id: string;
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

// ---- PATCH /api/user request ----

export interface UpdateUserRequest {
	username?: string;
	password?: string;
	current_password?: string;
	email?: string;
	shortcuts?: Shortcut[];
}
