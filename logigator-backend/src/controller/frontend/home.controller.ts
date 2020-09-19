import {Controller, CurrentUser, Get, Render, UseBefore} from 'routing-controllers';
import {User} from '../../database/entities/user.entity';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../../database/repositories/user.repository';
import {CheckAuthenticatedFrontMiddleware} from '../../middleware/auth/frontend-guards/check-authenticated-front.middleware';

@Controller()
export class HomeController {

	constructor(@InjectRepository() private userRepo: UserRepository) {}

	@Get('/')
	@Render('home')
	public async index() {
		return '';
	}

	@Get('/kek')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@Render('kek')
	public kek(@CurrentUser() user: User) {
		return {
			username: user.username,
			image: user.image.publicUrl
		};
	}


	@Get('/delete')
	public del(@CurrentUser() user: User) {
		this.userRepo.remove(user);
		return '';
	}

}
