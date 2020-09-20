import {Controller, Get, Render} from 'routing-controllers';

@Controller('/privacy-policy')
export class PrivacyPolicyController {

	@Get('/')
	@Render('privacy-policy')
	public async index() {
		return '';
	}

}
