import {Authorized, Controller, CurrentUser, Get, Render} from "routing-controllers";
import {User} from "../../database/entities/user.entity";

@Controller()
export class HomeController {

	constructor() {}

	@Get('/',)
	@Render('home')
	public async index() {
		return {};
	}

	@Get('/test')
	@Authorized()
	public test(@CurrentUser() user: User) {
		return JSON.stringify(user);
	}

}
