import {
	BadRequestError,
	Body,
	CurrentUser,
	Get,
	JsonController, Patch,
	ResponseClassTransformOptions,
	UseBefore,
	UseInterceptor
} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../../database/repositories/user.repository';
import {CheckAuthenticatedApiMiddleware} from '../../middleware/auth/api-guards/check-authenticated-api.middleware';
import {User} from '../../database/entities/user.entity';
import {UpdateUser} from '../../models/request/api/user/update-user';
import {Preferences} from '../../decorator/preferences.decorator';
import {UserPreferences} from '../../models/user-preferences';
import {UserService} from '../../services/user.service';
import {ShortcutRepository} from '../../database/repositories/shortcut.repository';

@JsonController('/api/user')
@UseInterceptor(ApiInterceptor)
export class UserController {
	constructor(
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private shortcutRepo: ShortcutRepository,
		private userService: UserService
	) { }

	@Get('/')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['privateUserData']})
	public async get(@CurrentUser() user: User) {
		await user.shortcuts;
		return user;
	}

	@Patch('/')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['privateUserData']})
	public async update(@CurrentUser() user: User, @Body() body: UpdateUser, @Preferences() preferences: UserPreferences) {
		if (body.email) {
			if (await this.userService.updateEmail(user, body.email, preferences.lang)) {
				throw new BadRequestError('Email already in use.');
			}
		}
		if (body.password) {
			await this.userService.updatePassword(user, body.password, body.current_password);
		}
		if (body.username) {
			await this.userService.updateUsername(user, body.username);
		}
		if (body.shortcuts) {
			await this.shortcutRepo.remove(await this.shortcutRepo.find({
				where: {
					user: user
				}
			}));
			user.shortcuts = Promise.resolve(body.shortcuts.map(x => x.toEntity()));
			await this.userRepo.save(user);
		}
		return user;
	}
}
