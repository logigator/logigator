import {ExpressMiddlewareInterface, Middleware} from 'routing-controllers';
import {Request, Response} from 'express';
import {updatePreferences} from '../../functions/update-preferences';
import { availableLanguages, LanguageCode } from '../../i18n';
import { availableThemes, defaultTheme, Theme, UserPreferences } from '../../models/user-preferences';

@Middleware({type: 'before'})
export class DefaultPreferencesMiddleware implements ExpressMiddlewareInterface {
	use(request: Request, response: Response, next: (err?: any) => any): any {
		const preferences = request.cookies.preferences ?? {};
		const patch: Partial<UserPreferences> = {};

		// Each preference is checked on its own, because the cookie is shared with
		// the editor, which writes one field at a time: repairing the language
		// would otherwise discard a theme the visitor chose there.
		if (!availableLanguages.includes(preferences.lang as LanguageCode)) {
			patch.lang = (request.acceptsLanguages().find(accepted => availableLanguages.includes(accepted as LanguageCode)) ?? 'en') as LanguageCode;
		}
		if (!availableThemes.includes(preferences.theme as Theme)) {
			patch.theme = defaultTheme;
		}

		if (Object.keys(patch).length > 0) {
			updatePreferences(request, response, patch);
		}
		next();
	}

}
