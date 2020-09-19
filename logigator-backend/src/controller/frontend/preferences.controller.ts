import {Controller, Get, Param, Res, Session} from 'routing-controllers';
import {Response} from 'express';

@Controller('/preferences')
export class PreferencesController {

	@Get('/set-lang/:lang')
	public setLanguage(@Param('lang') lang: string, @Session() session: any, @Res() response: Response) {
		if (['en', 'de'].includes(lang)) {
			session.preferences.lang = lang;
		}
		return response;
	}

}
