import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {ConfigService} from '../../services/config.service';
import fetch from 'node-fetch';

@Controller('/download')
export class DownloadController {

	constructor(private configService: ConfigService) {}

	@Get('/')
	@Render('download')
	@UseBefore(setTitleMiddleware('TITLE.DOWNLOAD'))
	public async index() {
		const response = await fetch('https://api.github.com/repos/logigator/logigator-editor/releases/latest');
		const releases = (await response.json()).assets;
		return {

		};
	}

}
