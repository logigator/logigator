import {Controller, CurrentUser, Get, QueryParam, Render, Session, UseBefore} from 'routing-controllers';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {TranslationService} from '../../../services/translation.service';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {User} from '../../../database/entities/user.entity';

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
	public async myProjects(@QueryParam('page') pageNumber = 0, @CurrentUser() user: User, @Session() session) {
		const page = await this.projectRepo.getPage(pageNumber, 12, {
			where: {
				user: user
			}
		});
		const entries = page.entries.map(entry => {
			(entry.lastEdited as any) = this.translationService.dateFormatDateTime(entry.lastEdited, session.preferences.lang);
			(entry as any).lastEditedShort = this.translationService.dateFormatDate(entry.lastEdited, session.preferences.lang);
			(entry.createdOn as any) = this.translationService.dateFormatDateTime(entry.lastEdited, session.preferences.lang);
			return entry;
		});
		return {
			entries,
			currentPage: page.page,
			totalPages: page.total
		};
	}
}
