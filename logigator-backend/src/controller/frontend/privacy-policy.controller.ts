import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/set-title-middleware';

@Controller('/privacy-policy')
export class PrivacyPolicyController {

	@Get('/')
	@Render('privacy-policy')
	@UseBefore(setTitleMiddleware('TITLE.PRIVACY_POLICY'))
	public async index() {
		return '';
	}

}
