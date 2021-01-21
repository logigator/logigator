import {Body, Controller, Post, Req, Res} from 'routing-controllers';
import {SetLanguage} from '../../models/request/frontend/preferences/set-language';
import {SetTheme} from '../../models/request/frontend/preferences/set-theme';
import {TranslationService} from '../../services/translation.service';
import {Referer} from '../../decorator/referer.decorator';
import {Request, Response} from 'express';
import {Redirect, RedirectFunction} from '../../decorator/redirect.decorator';
import {updatePreferences} from '../../functions/update-preferences';
import {getPathnameWithoutLang} from '../../functions/get-path-name-without-lang';


@Controller('/preferences')
export class PreferencesController {

	constructor(private translationService: TranslationService) {}

	@Post('/set-lang')
	public setLanguage(@Body() body: SetLanguage, @Req() req: Request, @Res() res: Response, @Referer() ref: string) {
		updatePreferences(req, res, {
			lang: body.lang
		});

		let redirectTarget = getPathnameWithoutLang(ref, this.translationService.availableLanguages);

		if (redirectTarget === '/') {
			redirectTarget += body.lang;
		} else {
			redirectTarget = '/' + body.lang + redirectTarget;
		}
		res.redirect(redirectTarget);
		return res;
	}

	@Post('/set-theme')
	public setTheme(@Body() body: SetTheme, @Req() req: Request, @Res() res: Response, @Redirect() redirect: RedirectFunction) {
		updatePreferences(req, res, {
			theme: body.dark_mode === 'on' ? 'dark' : 'light'
		});
		return redirect();
	}

}
