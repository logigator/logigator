import {Controller, CurrentUser, Get, QueryParam, Render, Session, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {TranslationService} from '../../../services/translation.service';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {User} from '../../../database/entities/user.entity';
import {Like} from 'typeorm';
import {Page} from '../../../database/repositories/pageable.repository';
import {Project} from '../../../database/entities/project.entity';

@Controller('/my/projects')
export class MyProjectsController {


	constructor(
		private translationService: TranslationService,
		@InjectRepository() private projectRepo: ProjectRepository
	) {}

	@Get('/')
	@Render('my-projects')
	@UseBefore(setTitleMiddleware('TITLE.PROJECTS'))
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async myProjects(@QueryParam('page') pageNumber: number, @CurrentUser() user: User, @Session() session) {
		const page = await this.projectRepo.getPage(pageNumber ?? 0, 12, {
			where: {
				user: user
			}
		});
		return {
			...this.pageToResponse(page, session.preferences.lang),
			viewScript: 'my-projects-comps'
		};
	}

	@Get('/page')
	@Render('my-projects-page')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async myProjectsPage(@QueryParam('page') pageNumber = 0, @QueryParam('search') search: string, @CurrentUser() user: User, @Session() session) {
		const page = await this.projectRepo.getPage(pageNumber ?? 0, 12, {
			where: {
				user: user,
				...(search && {name: Like('%' + search + '%')})
			}
		});
		return {
			...this.pageToResponse(page, session.preferences.lang),
			layout: false
		};
	}

	private pageToResponse(page: Page<Project>, language: string): any {
		const entries = page.entries.map(entry => {
			(entry.lastEdited as any) = this.translationService.dateFormatDateTime(entry.lastEdited, language);
			(entry as any).lastEditedShort = this.translationService.dateFormatDate(entry.lastEdited, language);
			(entry.createdOn as any) = this.translationService.dateFormatDateTime(entry.lastEdited, language);
			return entry;
		});
		return {
			entries,
			currentPage: page.page,
			totalPages: page.total
		};
	}
}
