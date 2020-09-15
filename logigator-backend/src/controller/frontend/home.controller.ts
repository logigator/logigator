import {Controller, CurrentUser, Get, Render, UseBefore} from "routing-controllers";
import {User} from "../../database/entities/user.entity";
import {CheckAuthenticatedFrontMiddleware} from "../../middleware/auth/frontend-guards/check-authenticated-front.middleware";

@Controller()
export class HomeController {

	constructor() {}

	@Get('/',)
	@Render('home')
	public async index() {
		return {};
	}

	@Get('/test')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public test(@CurrentUser() user: User) {
		return JSON.stringify(user);
	}

}
