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
		const examples = [
			{
				name: 'Basic Gates',
				previewDark: '/persisted/4904f030-480b-483c-b736-acbc9b7d0fdb.png',
				previewLight: '/persisted/11e2e3b4-4b81-429f-9330-5a09e3b91a16.png',
				link: '/editor'
			},
			{
				name: 'Some Example',
				previewDark: '/persisted/434cde3f-9b0d-4d60-b136-6a1b59e2ab25.png',
				previewLight: '/persisted/11e2e3b4-4b81-429f-9330-5a09e3b91a16.png',
				link: '/editor'
			},
			{
				name: 'Advanced',
				previewDark: '/persisted/4904f030-480b-483c-b736-acbc9b7d0fdb.png',
				previewLight: '/persisted/11e2e3b4-4b81-429f-9330-5a09e3b91a16.png',
				link: '/editor'
			},
			{
				name: 'Full Adder',
				previewDark: '/persisted/4904f030-480b-483c-b736-acbc9b7d0fdb.png',
				previewLight: '/persisted/11e2e3b4-4b81-429f-9330-5a09e3b91a16.png',
				link: '/editor'
			}
		];

		return {
			editorUrl: this.configService.getConfig('domains').editor,
			examples
		};
	}

}
