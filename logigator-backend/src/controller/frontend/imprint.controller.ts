import {Controller, Get, Render} from 'routing-controllers';

@Controller('/imprint')
export class ImprintController {

	@Get('/')
	@Render('imprint')
	public async index() {
		return '';
	}

}
