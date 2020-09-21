import {Body, ContentType, Controller, Post, Res, Session} from 'routing-controllers';
import {Response} from 'express';
import {SetLanguage} from '../../models/request/frontend/preferences/set-language';
import {SetTheme} from '../../models/request/frontend/preferences/set-theme';

@Controller('/preferences')
export class PreferencesController {

	@Post('/set-lang')
	public setLanguage(@Body() body: SetLanguage, @Session() session: any, @Res() response: Response) {
		session.preferences.lang = body.lang;
		response.redirect(body.submittedFrom);
		return response;
	}

	@Post('/set-theme')
	@ContentType('application/json')
	public setTheme(@Body() body: SetTheme, @Session() session: any) {
		session.preferences.theme = body.theme;
		return { success: true};
	}

}
