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
import {SendPasswordResetMail} from '../../models/request/frontend/auth/send-password-reset-mail';
import {ResetPassword} from '../../models/request/frontend/auth/reset-password';

@Controller('/auth')
export class AuthController {

	constructor(private userService: UserService) {}

	@Post('/local-register')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public localRegister(@Body() body: LocalRegister, @Preferences() preferences: UserPreferences, @Redirect() redirect: RedirectFunction) {
		return this.localRegisterShared(body, preferences, redirect);
	}

	@Post('/local-register-page')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public localRegisterPage(@Body() body: LocalRegister, @Preferences() preferences: UserPreferences, @Redirect() redirect: RedirectFunction) {
		return this.localRegisterShared(body, preferences, redirect);
	}

	private async localRegisterShared(body: LocalRegister, preferences: UserPreferences, redirect: RedirectFunction): Promise<Response> {
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

	@Post('/local-login-page')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
	@UseAfter(formErrorMiddleware())
	public localLoginPage() {
	}

	@Post('/local-login-electron')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
	@UseAfter(formErrorMiddleware())
	public localLoginElectron() {
	}

	@Post('/send-password-reset-mail')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async sendPasswordResetMail(@Body() body: SendPasswordResetMail, @Preferences() preferences: UserPreferences, @Redirect() redirect: RedirectFunction) {
		try {
			await this.userService.sendResetPasswordMail(body.email, preferences.lang);
			return redirect({ showInfoPopup: 'password-reset-mail-sent'});
		} catch (err) {
			if (err.message === 'reset_mail') {
				throw new FormDataError(body, undefined, 'resetMail');
			}
			if (err.message === 'user_not_found') {
				throw new FormDataError(body, 'email', 'noUser');
			}
			throw err;
		}
	}

	@Post('/reset-password')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async resetPassword(@Body() body: ResetPassword, @Redirect() redirect: RedirectFunction) {
		try {
			await this.userService.updatePasswordWithToken(body.token, body.password);
			return redirect({ showInfoPopup: 'password-reset'});
		} catch (err) {
			if (err.message === 'reset_timeout' || err.message === 'no_user') {
				throw new FormDataError(body, undefined, 'tokenInvalid');
			}
			throw new FormDataError(body, undefined, 'unknown');
		}
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
	@UseAfter(formErrorMiddleware(request => request.query.state as string ?? '/'))
	public googleAuthenticate() {
	}

	@Get('/twitter-login')
	@UseBefore(TwitterLoginMiddleware)
	public twitterLogin() {
	}

	@Get('/twitter-authenticate')
	@UseBefore(TwitterAuthenticationMiddleware)
	@UseAfter(formErrorMiddleware(request => request.query.state as string ?? '/'))
	public twitterAuthenticate() {
	}

	@Get('/logout')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public logout(@Req() request: Request, @Res() response: Response, @Redirect() redirect: RedirectFunction) {
		request.logout((err => console.error(err)));
		updateAuthenticatedCookie(request, response, false);
		return redirect({target: '/'});
	}

}
