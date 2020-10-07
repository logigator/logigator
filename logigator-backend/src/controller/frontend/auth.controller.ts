import {Body, Controller, Get, Post, Req, Res, UseAfter, UseBefore} from 'routing-controllers';
import {GoogleLoginMiddleware} from '../../middleware/auth/google-login.middleware';
import {GoogleAuthenticationMiddleware} from '../../middleware/auth/google-authentication.middleware';
import {TwitterLoginMiddleware} from '../../middleware/auth/twitter-login.middleware';
import {TwitterAuthenticationMiddleware} from '../../middleware/auth/twitter-authentication.middleware';
import {Request, Response} from 'express';
import {CheckNotAuthenticatedFrontMiddleware} from '../../middleware/auth/frontend-guards/check-not-authenticated-front.middleware';
import {CheckAuthenticatedFrontMiddleware} from '../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {LocalRegister} from '../../models/request/frontend/auth/local-register';
import {formErrorMiddleware} from '../../middleware/action/form-error.middleware';
import {FormDataError} from '../../errors/form-data.error';
import {UserService} from '../../services/user.service';
import {Redirect, RedirectFunction} from '../../decorator/redirect.decorator';
import {LocalAuthenticationMiddleware} from '../../middleware/auth/local-authentication.middleware';
import {ResendVerificationMail} from '../../models/request/frontend/auth/resend-verification-mail';
import {Preferences} from '../../decorator/preferences.decorator';
import {UserPreferences} from '../../models/user-preferences';
import {updateAuthenticatedCookie} from '../../functions/update-authenticated-cookie';

@Controller('/auth')
export class AuthController {

	constructor(private userService: UserService) {}

	@Post('/local-register')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async localRegister(@Body() body: LocalRegister, @Preferences() preferences: UserPreferences, @Redirect() redirect: RedirectFunction) {
		try {
			if (await this.userService.createLocalUser(body.username, body.email, body.password, preferences.lang)) {
				return redirect({ showInfoPopup: 'local-register'});
			}
		} catch (err) {
			if (err.message === 'verification_mail') {
				throw new FormDataError(body, undefined, 'verificationMail');
			}
			throw new FormDataError(body, undefined, 'unknown');
		}
		throw new FormDataError(body, 'email', 'emailTaken');
	}

	@Post('/local-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
	@UseAfter(formErrorMiddleware())
	public localLogin() {
	}

	@Post('/resend-verification-mail')
	@UseAfter(formErrorMiddleware())
	public async resendVerificationMail(@Body() body: ResendVerificationMail, @Preferences() preferences: UserPreferences, @Redirect() redirect: RedirectFunction) {
		try {
			await this.userService.resendVerificationMail(body.email, body.password, preferences.lang);
		} catch (err) {
			if (err.message === 'verification_mail') {
				throw new FormDataError(body, undefined, 'verificationMail');
			}
			throw err;
		}
		return redirect({ showInfoPopup: 'local-register'});
	}

	@Get('/google-login')
	@UseBefore(GoogleLoginMiddleware)
	public googleLogin() {
	}


	@Get('/google-authenticate')
	@UseBefore(GoogleAuthenticationMiddleware)
	@UseAfter(formErrorMiddleware((request, response) => response.locals.connectedAccounts ? '/my/account/security' : '/'))
	public googleAuthenticate() {
	}

	@Get('/twitter-login')
	@UseBefore(TwitterLoginMiddleware)
	public twitterLogin() {
	}

	@Get('/twitter-authenticate')
	@UseBefore(TwitterAuthenticationMiddleware)
	@UseAfter(formErrorMiddleware((request, response) => response.locals.connectedAccounts ? '/my/account/security' : '/'))
	public twitterAuthenticate() {
	}

	@Get('/logout')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public logout(@Req() request: Request, @Res() response: Response, @Redirect() redirect: RedirectFunction) {
		request.logout();
		updateAuthenticatedCookie(request, response, false);
		return redirect({target: '/'});
	}

}
