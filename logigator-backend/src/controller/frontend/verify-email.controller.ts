import {Controller, Get, Param, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {UserService} from '../../services/user.service';

@Controller('/verify-email')
export class VerifyEmailController {

	constructor(private userService: UserService) {}

	@Get('/:authCode')
	@Render('verify-email')
	@UseBefore(setTitleMiddleware('TITLE.VERIFY_EMAIL'))
	public async verifyEmail(@Param('authCode') authCode: string) {
		if (await this.userService.verifyEmail(authCode)) {
			return {success: true};
		}
		return {success: false};
	}

}
