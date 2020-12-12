import 'express-session';

declare module 'express-session' {

	interface SessionData {
		formErrors: any;
		infoPopup?: {
			show?: string;
			data?: any;
		};
	}
}
