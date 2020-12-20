import {Controller, Get, NotFoundError, Param, Render} from 'routing-controllers';
import {ConfigService} from '../../../services/config.service';
import {TranslationService} from '../../../services/translation.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {ComponentRepository} from '../../../database/repositories/component.repository';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';

@Controller('/community')
export class CommunityProjCompController {

	constructor(
		private configService: ConfigService,
		private translationService: TranslationService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository
	) {}

	@Get('/project/:link')
	@Render('community-proj-comp')
	public async project(@Param('link') link: string, @Preferences() preferences: UserPreferences) {
		const project = (await this.projectRepo.findOne({
			where: {
				link
			}
		}));
		if (!project)
			throw new NotFoundError();

		const user = await project.user;

		return {
			...project,
			previewDark: project.previewDark?.publicUrl ?? '/assets/default-preview.svg',
			previewLight: project.previewLight?.publicUrl ?? '/assets/default-preview.svg',
			editorUrl: this.configService.getConfig('domains').editor + '/share/' + project.link,
			cloneUrl: '/community/clone/' + project.link,
			stargazers: '/community/project/' + project.link + '/stargazers',
			username: user.username,
			userImage: user.image?.publicUrl ?? '/assets/default-user.svg',
			userUrl: 'community/user/' + user.id,
			stars: 10
		};
	}

	@Get('/component/:link')
	@Render('community-proj-comp')
	public async component(@Param('link') link: string, @Preferences() preferences: UserPreferences) {
		const comp = (await this.componentRepo.findOne({
			where: {
				link
			}
		}));
		if (!comp)
			throw new NotFoundError();

		const user = await comp.user;

		return {
			...comp,
			previewDark: comp.previewDark?.publicUrl ?? '/assets/default-preview.svg',
			previewLight: comp.previewLight?.publicUrl ?? '/assets/default-preview.svg',
			editorUrl: this.configService.getConfig('domains').editor + '/share/' + comp.link,
			cloneUrl: '/community/clone/' + comp.link,
			stargazers: '/community/component/' + comp.link + '/stargazers',
			username: user.username,
			userImage: user.image?.publicUrl ?? '/assets/default-user.svg',
			userUrl: 'community/user/' + user.id,
			stars: 10
		};
	}

}
