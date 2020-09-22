import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';

@Controller('/')
export class HomeController {

	@Get('/')
	@Render('home')
	@UseBefore(setTitleMiddleware('TITLE.HOME'))
	public async index() {
		return '';
	}

}
