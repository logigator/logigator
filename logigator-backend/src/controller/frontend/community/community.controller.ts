import {Controller, Get, QueryParam, Render, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {ConfigService} from '../../../services/config.service';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {classToPlain} from 'class-transformer';
import {TranslationService} from '../../../services/translation.service';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';
import {ComponentRepository} from '../../../database/repositories/component.repository';
import {UserRepository} from '../../../database/repositories/user.repository';

@Controller('/community')
export class CommunityController {

	constructor(
		private configService: ConfigService,
		private translationService: TranslationService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private userRepo: UserRepository
	) {}

	@Get('/projects')
	@Render('community')
	@UseBefore(setTitleMiddleware('TITLE.COMMUNITY'))
	public async projects(@QueryParam('page') pageNumber: number, @QueryParam('search') search: string, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getProjectsPage(pageNumber, search, preferences.lang)),
			searchTerm: search,
			type: 'projects',
			viewScript: 'community'
		};
	}

	@Get('/projects/page')
	@Render('community-page')
	public async projectsPage(@QueryParam('page') pageNumber = 0, @QueryParam('search') search: string, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getProjectsPage(pageNumber, search, preferences.lang)),
			layout: false
		};
	}

	@Get('/components')
	@Render('community')
	@UseBefore(setTitleMiddleware('TITLE.COMMUNITY'))
	public async components(@QueryParam('page') pageNumber: number, @QueryParam('search') search: string, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getComponentsPage(pageNumber, search, preferences.lang)),
			searchTerm: search,
			type: 'components',
			viewScript: 'community'
		};
	}

	@Get('/components/page')
	@Render('community-page')
	public async componentsPage(@QueryParam('page') pageNumber = 0, @QueryParam('search') search: string, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getComponentsPage(pageNumber, search, preferences.lang)),
			layout: false
		};
	}

	private async getProjectsPage(pageNumber: number, search: string, language: string): Promise<any> {
		const page = await this.projectRepo.getSharedProjectPage(pageNumber ?? 0, 12, search);

		const entries = await Promise.all(page.entries.map(async entry => {
			const transformed = classToPlain(entry, {groups: ['detailed']});
			transformed.lastEdited = this.translationService.dateFormatDate(entry.lastEdited, language);
			transformed.url = 'community/project/' + entry.link;
			transformed.editorUrl = this.configService.getConfig('domains').editor + '/share/' + entry.link;
			transformed.previewDark = entry.previewDark?.publicUrl ?? '/assets/default-preview.svg';
			transformed.previewLight = entry.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			transformed.stargazersCount = await this.projectRepo.getStargazersCount(entry);

			const user = await this.userRepo.getUserOwningProject(entry.id);
			transformed.username = user.username;
			transformed.userImage = user.image?.publicUrl ?? '/assets/default-user.svg';
			transformed.userUrl = 'community/user/' + user.id;

			return transformed;
		}));
		return {
			entries,
			currentPage: page.page,
			totalPages: page.total
		};
	}

	private async getComponentsPage(pageNumber: number, search: string, language: string): Promise<any> {
		const page = await this.componentRepo.getSharedComponentsPage(pageNumber ?? 0, 12, search);

		const entries = await Promise.all(page.entries.map(async entry => {
			const transformed = classToPlain(entry);
			transformed.lastEdited = this.translationService.dateFormatDate(entry.lastEdited, language);
			transformed.url = 'community/component/' + entry.link;
			transformed.editorUrl =  this.configService.getConfig('domains').editor + '/share/' + entry.link;
			transformed.previewDark = entry.previewDark?.publicUrl ?? '/assets/default-preview.svg';
			transformed.previewLight = entry.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			transformed.stargazersCount = await this.componentRepo.getStargazersCount(entry);

			const user = await this.userRepo.getUserOwningComponent(entry.id);
			transformed.username = user.username;
			transformed.userImage = user.image?.publicUrl ?? '/assets/default-user.svg';
			transformed.userUrl = 'community/user/' + user.id;

			return transformed;
		}));
		return {
			entries,
			currentPage: page.page,
			totalPages: page.total
		};
	}

}
