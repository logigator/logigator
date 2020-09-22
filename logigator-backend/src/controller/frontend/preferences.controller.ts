import {Body, ContentType, Controller, Post, Session} from 'routing-controllers';
import {SetLanguage} from '../../models/request/frontend/preferences/set-language';
import {SetTheme} from '../../models/request/frontend/preferences/set-theme';
import {RedirectToRef} from '../../decorator/redirect-to-ref.decorator';

@Controller('/preferences')
export class PreferencesController {

	@Post('/set-lang')
	public setLanguage(@Body() body: SetLanguage, @Session() session: any, @RedirectToRef() redirect) {
		session.preferences.lang = body.lang;
		return redirect();
	}

	@Post('/set-theme')
	@ContentType('application/json')
	public setTheme(@Body() body: SetTheme, @Session() session: any) {
		session.preferences.theme = body.theme;
		return {success: true};
	}

}
