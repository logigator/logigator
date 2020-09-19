import {Controller, Get, Render} from 'routing-controllers';

@Controller()
export class HomeController {

	@Get('/')
	@Render('home')
	public async index() {
		return '';
	}

}
