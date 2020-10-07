import {Controller, CurrentUser, Get, Render, UseBefore} from 'routing-controllers';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {User} from '../../../database/entities/user.entity';

@Controller('/my/account')
export class MyAccountController {

	@Get('/')
	@Render('my-account')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT'))
	public account() {
		return '';
	}

	@Get('/profile')
	@Render('my-account-profile')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT_PROFILE'))
	public accountProfile(@CurrentUser() user: User) {

		return {
			active: 'account-profile',
			userData: {
				email: user.email,
				username: user.username,
				hasImage: !!user.image
			}
		};
	}

	@Get('/security')
	@Render('my-account-security')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT_SECURITY'))
	public accountSecurity() {
		return {
			active: 'account-security'
		};
	}

	@Get('/delete')
	@Render('my-account-delete')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT_DELETE'))
	public accountDelete() {
		return {
			active: 'account-delete'
		};
	}

}
