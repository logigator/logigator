import {Body, Controller, CurrentUser, Get, Post, Render, UseAfter, UseBefore} from 'routing-controllers';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {User} from '../../../database/entities/user.entity';
import {formErrorMiddleware} from '../../../middleware/action/form-error.middleware';
import {ProfileUpdateUsername} from '../../../models/request/frontend/my-account/profile-update-username';
import {Redirect, RedirectFunction} from '../../../decorator/redirect.decorator';
import {UserService} from '../../../services/user.service';
import {ProfileUpdateEmail} from '../../../models/request/frontend/my-account/profile-update-email';
import {FormDataError} from '../../../errors/form-data.error';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';

@Controller('/my/account')
export class MyAccountController {

	constructor(private userService: UserService) {}

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

	@Post('/profile/update-username')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async accountProfileUpdateUsername(@CurrentUser() user: User, @Body() body: ProfileUpdateUsername, @Redirect() redirect: RedirectFunction) {
		await this.userService.updateUsername(user, body.username);
		return redirect();
	}

	@Post('/profile/update-email')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async accountProfileUpdateEmail(@CurrentUser() user: User, @Body() body: ProfileUpdateEmail, @Redirect() redirect: RedirectFunction, @Preferences() preferences: UserPreferences) {
		try {
			if (await this.userService.updateEmail(user, body.email, preferences.lang)) {
				return redirect({ showInfoPopup: 'email-updated'});
			}
		} catch (err) {
			if (err.message === 'verification_mail') {
				throw new FormDataError(body, undefined, 'verificationMail');
			}
			throw new FormDataError(body, undefined, 'unknown');
		}
		throw new FormDataError(body, 'email', 'emailTaken');
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
