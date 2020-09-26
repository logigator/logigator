import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {ConfigService} from '../../services/config.service';

@Controller('/')
export class HomeController {

	constructor(private configService: ConfigService) {}

	@Get('/')
	@Render('home')
	@UseBefore(setTitleMiddleware('TITLE.HOME'))
	public async index() {
		return {
			editorUrl: this.configService.getConfig('domains').editor
		};
	}

}
