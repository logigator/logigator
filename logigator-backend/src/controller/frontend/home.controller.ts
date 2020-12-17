import {Controller, Get, Render, ResponseClassTransformOptions, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../middleware/action/set-title-middleware';
import {ConfigService} from '../../services/config.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';
import {ComponentRepository} from '../../database/repositories/component.repository';

@Controller('/')
export class HomeController {

	constructor(
		private configService: ConfigService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository
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
			},
			order: {
				id: 'ASC'
			},
			take: 4
		}).then(projects => {
			for (const project of projects) {
				project.link = this.configService.getConfig('domains').editor + '/share/' + project.link;
				(project as any).previewDark = project.previewDark?.publicUrl ?? '/assets/default-preview.svg';
				(project as any).previewLight = project.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			}
			return projects;
		});

		const sharedComps = await this.componentRepo.find({
			where: {
				public: true
			},
			order: {
				lastEdited: 'DESC'
			},
			take: 4
		}).then(comps => {
			for (const comp of comps) {
				comp.link = 'community/component/' + comp.link;
				(comp as any).previewDark = comp.previewDark?.publicUrl ?? '/assets/default-preview.svg';
				(comp as any).previewLight = comp.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			}
			return comps;
		});

		const sharedProjects = await this.projectRepo.find({
			where: {
				public: true
			},
			order: {
				lastEdited: 'DESC'
			},
			take: 4
		}).then(projects => {
			for (const project of projects) {
				project.link = 'community/project/' + project.link;
				(project as any).previewDark = project.previewDark?.publicUrl ?? '/assets/default-preview.svg';
				(project as any).previewLight = project.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			}
			return projects;
		});

		return {
			editorUrl: this.configService.getConfig('domains').editor,
			examples,
			sharedProjects,
			sharedComps
		};
	}

}
