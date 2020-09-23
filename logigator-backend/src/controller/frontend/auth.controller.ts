import {Body, Controller, Get, Post, Req, Session, UseAfter, UseBefore} from 'routing-controllers';
import {GoogleLoginMiddleware} from '../../middleware/auth/google-login.middleware';
import {GoogleAuthenticationMiddleware} from '../../middleware/auth/google-authentication.middleware';
import {TwitterLoginMiddleware} from '../../middleware/auth/twitter-login.middleware';
import {TwitterAuthenticationMiddleware} from '../../middleware/auth/twitter-authentication.middleware';
import {Request} from 'express';
import {CheckNotAuthenticatedFrontMiddleware} from '../../middleware/auth/frontend-guards/check-not-authenticated-front.middleware';
import {CheckAuthenticatedFrontMiddleware} from '../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {LocalRegister} from '../../models/request/frontend/auth/local-register';
import {FormErrorMiddleware} from '../../middleware/action/form-error.middleware';
import {FormDataError} from '../../errors/form-data.error';
import {LocalLogin} from '../../models/request/frontend/auth/local-login';
import {UserService} from '../../services/user.service';
import {Redirect, RedirectFunction} from '../../decorator/redirect.decorator';
import {LocalAuthenticationMiddleware} from '../../middleware/auth/local-authentication.middleware';

@Controller('/auth')
export class AuthController {

	constructor(private userService: UserService) {}

	@Post('/local-register')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	@UseAfter(FormErrorMiddleware)
	public async localRegister(@Body() body: LocalRegister, @Redirect() redirect: RedirectFunction) {
		try {
			if (await this.userService.createLocalUser(body.username, body.email, body.password)) {
				return redirect({ showInfoPopup: 'local-register'});
			}
		} catch (err) {
			throw new FormDataError(body, undefined, 'unknown');
		}
		throw new FormDataError(body, 'email', 'emailTaken');
	}

	@Post('/local-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, LocalAuthenticationMiddleware)
	@UseAfter(FormErrorMiddleware)
	public localLogin(@Body() body: LocalLogin, @Redirect() redirect: RedirectFunction) {
		return redirect({ showInfoPopup: 'local-register'});
	}

	@Get('/google-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, GoogleLoginMiddleware)
	public googleLogin() {
	}


	@Get('/google-authenticate')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, GoogleAuthenticationMiddleware)
	@UseAfter(FormErrorMiddleware)
	public googleAuthenticate() {
	}

	@Get('/twitter-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, TwitterLoginMiddleware)
	public twitterLogin() {
	}

	@Get('/twitter-authenticate')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, TwitterAuthenticationMiddleware)
	@UseAfter(FormErrorMiddleware)
	public twitterAuthenticate() {
	}

	@Get('/logout')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public logout(@Session() sess: any, @Req() request: Request, @Redirect() redirect: RedirectFunction) {
		request.logout();
		return redirect({target: '/'});
	}

}
