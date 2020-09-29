import {Response, Request} from 'express';
import {UserPreferences} from '../models/user-preferences';


export function updatePreferences(request: Request, response: Response, preferences: Partial<UserPreferences>) {
	const newPreferences = {
		...request.cookies.preferences,
		...preferences
	};
	request.cookies.preferences = newPreferences;

	response.cookie('preferences', newPreferences, {
		httpOnly: false,
		secure: false,
		maxAge: 1000 * 60 * 60 * 24 * 365 // 1 year
	});
}
