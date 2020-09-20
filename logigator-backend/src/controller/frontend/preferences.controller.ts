import {Body, Controller, Post, Res, Session} from 'routing-controllers';
import {Response} from 'express';
import {SetLanguage} from '../../models/request/frontend/preferences/set-language';

@Controller('/preferences')
export class PreferencesController {

	@Post('/set-lang')
	public setLanguage(@Body() body: SetLanguage, @Session() session: any, @Res() response: Response) {
		session.preferences.lang = body.lang;
		response.redirect(body.submittedFrom);
		return response;
	}

}
