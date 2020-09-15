import {Controller, Get, Post, Req, Res, UseBefore} from "routing-controllers";
import {GoogleLoginMiddleware} from "../../middleware/auth/google-login.middleware";
import {GoogleAuthenticationMiddleware} from "../../middleware/auth/google-authentication.middleware";
import {TwitterLoginMiddleware} from "../../middleware/auth/twitter-login.middleware";
import {TwitterAuthenticationMiddleware} from "../../middleware/auth/twitter-authentication.middleware";
import {Request, Response} from 'express';
import {CheckNotAuthenticatedFrontMiddleware} from "../../middleware/auth/frontend-guards/check-not-authenticated-front.middleware";
import {CheckAuthenticatedFrontMiddleware} from "../../middleware/auth/frontend-guards/check-authenticated-front.middleware";

@Controller('/auth')
export class AuthController {

	@Post('/local-register')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	public localRegister() {
	}

	@Post('/local-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	public localLogin() {
	}

	@Get('/google-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, GoogleLoginMiddleware)
	public googleLogin() {
	}

	@Get('/google-authenticate')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, GoogleAuthenticationMiddleware)
	public googleAuthenticate() {
	}

	@Get('/twitter-login')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, TwitterLoginMiddleware)
	public twitterLogin() {
	}

	@Get('/twitter-authenticate')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, TwitterAuthenticationMiddleware)
	public twitterAuthenticate() {
	}

	@Get('/logout')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public logout(@Req() request: Request, @Res() response: Response) {
		request.logOut();
		response.redirect('/')
	}

}
