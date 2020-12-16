import {Controller, Get, Render, ResponseClassTransformOptions, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {ConfigService} from '../../services/config.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';

@Controller('/examples')
export class ExamplesController {

	constructor(
		private configService: ConfigService,
		@InjectRepository() private projectRepo: ProjectRepository
	) {}

	@Get('/')
	@Render('examples')
	@ResponseClassTransformOptions({
		groups: ['showShareLinks']
	})
	@UseBefore(setTitleMiddleware('TITLE.EXAMPLES'))
	public async index() {
		const examples = await this.projectRepo.find({
			where: {
				user: '00000000-0000-0000-0000-000000000000'
			}
		}).then(projects => {
			for (const project of projects) {
				project.link = this.configService.getConfig('domains').editor + '/share/' + project.link;
				(project as any).previewDark = project.previewDark?.publicUrl ?? '/assets/default-preview.svg';
				(project as any).previewLight = project.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			}
			return projects;
		});

		return {
			examples
		};
	}

}
