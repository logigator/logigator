import {Response, Request} from 'express';
import {UserPreferences} from '../models/user-preferences';


export function updatePreferences(request: Request, response: Response, preferences: Partial<UserPreferences>) {
	// The cookie is client-writable, and cookie-parser hands anything but its
	// `j:` JSON encoding through as a plain string — spreading one of those would
	// turn its characters into preferences.
	const current = typeof request.cookies.preferences === 'object' && request.cookies.preferences !== null
		? request.cookies.preferences
		: {};

	const newPreferences = {
		...current,
		...preferences
	};
	request.cookies.preferences = newPreferences;

	response.cookie('preferences', newPreferences, {
		httpOnly: false,
		secure: false,
		maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year
	});
}
