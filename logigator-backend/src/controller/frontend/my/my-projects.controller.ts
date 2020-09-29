import {
	Controller,
	CurrentUser,
	Get,
	Param,
	QueryParam,
	Render,
	Session,
	UseBefore
} from 'routing-controllers';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {TranslationService} from '../../../services/translation.service';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {User} from '../../../database/entities/user.entity';
import {Like} from 'typeorm';
import {Page} from '../../../database/repositories/pageable.repository';
import {Project} from '../../../database/entities/project.entity';
import {ProjectDependencyRepository} from '../../../database/repositories/project-dependency.repository';

@Controller('/my/projects')
export class MyProjectsController {

	constructor(
		private translationService: TranslationService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository
	) {}

	@Get('/')
	@Render('my-projects')
	@UseBefore(setTitleMiddleware('TITLE.PROJECTS'))
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async myProjects(@QueryParam('page') pageNumber: number, @QueryParam('search') search: string, @CurrentUser() user: User, @Session() session) {
		return {
			...(await this.getProjectsPage(pageNumber, search, user, session.preferences.lang)),
			searchTerm: search,
			viewScript: 'my-projects-comps'
		};
	}

	@Get('/page')
	@Render('my-projects-page')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async myProjectsPage(@QueryParam('page') pageNumber = 0, @QueryParam('search') search: string, @CurrentUser() user: User, @Session() session) {
		return {
			...(await this.getProjectsPage(pageNumber, search, user, session.preferences.lang)),
			layout: false
		};
	}

	@Get('/info/:id')
	@Render('project-component-info-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async infoPopup(@Param('id') id: string, @CurrentUser() user: User, @Session() session) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);
		const dependencies = (await this.projectDepRepo.find({
			where: {
				dependent: project
			}
		})).reduce((prev, cur) => {
			return prev + ', ' + cur.dependency.name;
		}, '');

		(project.lastEdited as any) = this.translationService.dateFormatDateTime(project.lastEdited, session.preferences.lang);
		(project.createdOn as any) = this.translationService.dateFormatDateTime(project.lastEdited, session.preferences.lang);
		(project as any).numInputs = '0';
		(project as any).numOutputs = '1'; // cast to string because of 0 problem
		return {
			...project,
			dependencies,
			layout: false
		};
	}

	private async getProjectsPage(pageNumber: number, search: string, user: User, language: string): Promise<any> {
		const page = await this.projectRepo.getProjectPageForUser(pageNumber ?? 0, 12, user, search);

		const entries = page.entries.map(entry => {
			(entry.lastEdited as any) = this.translationService.dateFormatDate(entry.lastEdited, language);
			return entry;
		});
		return {
			entries,
			currentPage: page.page,
			totalPages: page.total
		};
	}
}
