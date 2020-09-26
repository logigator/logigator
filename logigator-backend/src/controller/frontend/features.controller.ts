import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';

@Controller('/features')
export class FeaturesController {

	@Get('/')
	@Render('features')
	@UseBefore(setTitleMiddleware('TITLE.FEATURES'))
	public async features() {
		return '';
	}

}
