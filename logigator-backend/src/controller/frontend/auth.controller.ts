import {Controller, Get, Post, UseBefore} from "routing-controllers";
import {GoogleLoginMiddleware} from "../../middleware/auth/google-login.middleware";
import {GoogleAuthenticationMiddleware} from "../../middleware/auth/google-authentication.middleware";

@Controller('/auth')
export class AuthController {

	@Post('/local-register')
	public localRegister() {
	}

	@Post('/local-login')
	public localLogin() {
	}

	@Get('/google-login')
	@UseBefore(GoogleLoginMiddleware)
	public googleLogin() {
	}

	@Get('/google-authenticate')
	@UseBefore(GoogleAuthenticationMiddleware)
	public googleAuthenticate() {
	}

	@Get('/twitter-login')
	public twitterLogin() {
	}

}
