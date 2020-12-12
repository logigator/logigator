export interface User {
	username: string;
	email: string;
	image?: {
		mimeType?: string;
		hash?: string;
		publicUrl: string;
	};
	shortcuts: UserShortcut[];
}

export interface UserShortcut {
	name: string;
	keyCode: string;
	shift: boolean;
	ctrl: boolean;
	alt: boolean;
}
