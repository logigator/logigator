import {
	BadRequestError,
	Body,
	Controller,
	CurrentUser,
	Get,
	Post,
	Render,
	Req,
	Res, UploadedFile,
	UseAfter,
	UseBefore
} from 'routing-controllers';
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
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProfilePictureRepository} from '../../../database/repositories/profile-picture.repository';
import {SecurityUpdatePassword} from '../../../models/request/frontend/my-account/security-update-password';
import {UserRepository} from '../../../database/repositories/user.repository';
import {updateAuthenticatedCookie} from '../../../functions/update-authenticated-cookie';
import {Request, Response} from 'express';
import {DeleteDelete} from '../../../models/request/frontend/my-account/delete-delete';
import {getUploadedFileOptions} from '../../../functions/get-uploaded-file-options';
import {ProfilePicture} from '../../../database/entities/profile-picture.entity';

@Controller('/my/account')
export class MyAccountController {

	constructor(
		private userService: UserService,
		@InjectRepository() private profilePictureRepo: ProfilePictureRepository,
		@InjectRepository() private userRepo: UserRepository
	) {}

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
			viewScript: 'my-account-profile',
			additionalScript: '/vendor/cropperjs/cropper.min.js',
			additionalCss: '/vendor/cropperjs/cropper.min.css',
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

	@Post('/profile/delete-image')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async accountProfileDeleteImage(@CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		if (!user.image) {
			return redirect();
		}
		await this.profilePictureRepo.remove(user.image);
		return redirect();
	}

	@Post('/profile/update-image')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async accountProfileUpdateImage(@CurrentUser() user: User, @UploadedFile('image', {options: getUploadedFileOptions(), required: true}) image: any) {
		if (image.mimetype !== 'image/png')
			throw new BadRequestError('Invalid MIME type');

		const userImage = user.image ?? new ProfilePicture();
		userImage.setFileContent(image.buffer);
		userImage.mimeType = image.mimetype;
		user.image = userImage;
		await this.userRepo.save(user);
		return {
			success: true
		};
	}

	@Get('/security')
	@Render('my-account-security')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT_SECURITY'))
	public accountSecurity(@CurrentUser() user: User) {
		return {
			active: 'account-security',
			connectedGoogle: !!user.googleUserId,
			connectedTwitter: !!user.twitterUserId,
			localLoginPassword: !!user.password
		};
	}

	@Post('/security/update-password')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async accountSecurityUpdatePassword(@CurrentUser() user: User, @Body() body: SecurityUpdatePassword, @Redirect() redirect: RedirectFunction) {
		try {
			await this.userService.updatePassword(user, body.password, body.current_password);
			return redirect({showInfoPopup: 'password-changed'});
		} catch (err) {
			if (err.message === 'invalid_password') {
				throw new FormDataError(body, 'current_password', 'invalid');
			} else {
				throw new FormDataError(body, undefined, 'unknown');
			}
		}
	}

	@Get('/delete')
	@Render('my-account-delete')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.ACCOUNT_DELETE'))
	public accountDelete(@CurrentUser() user: User) {
		return {
			active: 'account-delete',
			hasPassword: !!user.password
		};
	}

	@Post('/delete/delete')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware())
	public async accountDeleteDelete(@CurrentUser() user: User, @Body() body: DeleteDelete, @Redirect() redirect: RedirectFunction, @Req() request: Request, @Res() response: Response) {
		try {
			await this.userService.remove(user, body.password);
		} catch (e) {
			throw new FormDataError(body, 'password', 'invalid');
		}
		request.logout();
		updateAuthenticatedCookie(request, response, false);
		return redirect({target: '/', showInfoPopup: 'account-deleted'});
	}

}
