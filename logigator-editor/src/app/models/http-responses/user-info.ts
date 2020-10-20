import {EditorAction} from '../editor-action';

export interface UserInfo {
	user: {
		username: string;
		email: string;
		login_type: string;
		profile_image: string;
	};
	shortcuts: {
		action: EditorAction;
		alt: boolean;
		ctrl: boolean;
		shift: boolean;
		key_code: string,
	}[];
}

