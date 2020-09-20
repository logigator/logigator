import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/set-title-middleware';

@Controller('/imprint')
export class ImprintController {

	@Get('/')
	@Render('imprint')
	@UseBefore(setTitleMiddleware('TITLE.IMPRINT'))
	public async index() {
		return '';
	}

}
