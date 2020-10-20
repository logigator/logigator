import {
	CurrentUser,
	Get,
	JsonController,
	ResponseClassTransformOptions,
	UseBefore,
	UseInterceptor
} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../../database/repositories/user.repository';
import {CheckAuthenticatedApiMiddleware} from '../../middleware/auth/api-guards/check-authenticated-api.middleware';
import {User} from '../../database/entities/user.entity';

@JsonController('/api/user')
@UseInterceptor(ApiInterceptor)
export class UserController {
	constructor(
		@InjectRepository() private userRepo: UserRepository
	) { }

	@Get('/')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['privateUserData']})
	public async get(@CurrentUser() user: User) {
		return user;
	}
}
