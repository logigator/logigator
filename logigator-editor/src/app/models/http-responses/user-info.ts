import {ShortcutAction} from '../shortcut-map';

export interface UserInfo {
	user: {
		username: string;
		email: string;
		login_type: string;
		profile_image: string;
	};
	shortcuts: {
		name: ShortcutAction
		alt: boolean;
		ctrl: boolean;
		shift: boolean;
		key_code: string,
	}[];
}

