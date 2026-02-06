import {Controller, Get, QueryParam, Render, UseBefore} from 'routing-controllers';
import {CheckNotAuthenticatedFrontMiddleware} from '../../middleware/auth/frontend-guards/check-not-authenticated-front.middleware';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';

@Controller()
export class AuthPagesController {

	@Get('/login')
	@Render('login-page')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.LOGIN'))
	public login() {
	}

	@Get('/register')
	@Render('register-page')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.REGISTER'))
	public register() {
	}

	@Get('/reset-password')
	@Render('reset-password')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.RESET_PASSWORD'))
	public resetPassword(@QueryParam('token') token: string) {
		return {
			token
		};
	}

	@Get('/login-electron')
	@Render('login-electron')
	@UseBefore(CheckNotAuthenticatedFrontMiddleware)
	public loginElectron() {
		return {
			layout: false
		};
	}

}
