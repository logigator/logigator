import {Controller, CookieParams, CurrentUser, Get, Render} from 'routing-controllers';
import {User} from '../../database/entities/user.entity';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {UserRepository} from '../../database/repositories/user.repository';

@Controller()
export class HomeController {

	constructor(@InjectRepository() private userRepo: UserRepository) {}

	@Get('/')
	@Render('home')
	public async index(@CurrentUser() user: User) {
		return user;
	}

	@Get('/delete')
	public del(@CurrentUser() user: User) {
		this.userRepo.remove(user);
		return '';
	}

}
