import {Controller, Get, Render, ResponseClassTransformOptions, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {ConfigService} from '../../services/config.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';

@Controller('/')
export class HomeController {

	constructor(
		private configService: ConfigService,
		@InjectRepository() private projectRepo: ProjectRepository
	) {}

	@Get('/')
	@Render('home')
	@ResponseClassTransformOptions({
		groups: ['showShareLinks']
	})
	@UseBefore(setTitleMiddleware('TITLE.HOME'))
	public async index() {
		const examples = await this.projectRepo.find({
			where: {
				user: '00000000-0000-0000-0000-000000000000'
			}
		}).then(projects => {
			for (const project of projects) {
				project.link = this.configService.getConfig('domains').editor + '/share/' + project.link;
			}
			return projects;
		});

		return {
			editorUrl: this.configService.getConfig('domains').editor,
			examples
		};
	}

}
