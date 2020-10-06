import {Controller, CurrentUser, Get, Render, UseBefore} from 'routing-controllers';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {User} from '../../../database/entities/user.entity';

@Controller('/my/account')
export class MyAccountController {

	@Get('/')
	@Render('my-account')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('ACCOUNT.SETTINGS'))
	public account() {
		return '';
	}

	@Get('/profile')
	@Render('my-account-profile')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT_PROFILE'))
	public accountProfile(@CurrentUser() user: User) {

		return {
			userData: {
				email: user.email,
				username: user.username,
				hasImage: !!user.image
			}
		};
	}

}
