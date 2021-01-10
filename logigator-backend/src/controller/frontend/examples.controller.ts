import {Controller, Get, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {ConfigService} from '../../services/config.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';
import {classToPlain} from 'class-transformer';

@Controller('/examples')
export class ExamplesController {

	constructor(
		private configService: ConfigService,
		@InjectRepository() private projectRepo: ProjectRepository
	) {}

	@Get('/')
	@Render('examples')
	@UseBefore(setTitleMiddleware('TITLE.EXAMPLES'))
	public async index() {
		const examples = await this.projectRepo.find({
			where: {
				user: '00000000-0000-0000-0000-000000000000'
			}
		}).then(projects => {
			return projects.map(project => {
				const p = classToPlain(project);
				p.link = this.configService.getConfig('domains').editor + '/share/' + project.link;
				p.cloneLink = '/community/clone/project/' + project.link;
				p.previewDark = project.previewDark?.publicUrl ?? '/assets/default-preview.svg';
				p.previewLight = project.previewLight?.publicUrl ?? '/assets/default-preview.svg';
				return p;
			});
		});

		return {
			examples
		};
	}

}
