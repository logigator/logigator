import {
	Body,
	ContentType,
	Controller,
	CurrentUser,
	Get,
	Param,
	Post,
	QueryParam,
	Render, UseAfter,
	UseBefore
} from 'routing-controllers';
import {setTitleMiddleware} from '../../../middleware/action/set-title-middleware';
import {TranslationService} from '../../../services/translation.service';
import {CheckAuthenticatedFrontMiddleware} from '../../../middleware/auth/frontend-guards/check-authenticated-front.middleware';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../../database/repositories/project.repository';
import {User} from '../../../database/entities/user.entity';
import {ProjectDependencyRepository} from '../../../database/repositories/project-dependency.repository';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';
import {EditProject} from '../../../models/request/frontend/my-projects/edit-project';
import {formErrorMiddleware} from '../../../middleware/action/form-error.middleware';
import {CreateProject} from '../../../models/request/shared/create-project';
import {ConfigService} from '../../../services/config.service';
import {ShareProject} from '../../../models/request/frontend/my-projects/share-project';
import { v4 as uuid } from 'uuid';
import {Redirect, RedirectFunction} from '../../../decorator/redirect.decorator';
import {classToPlain} from 'class-transformer';

@Controller('/my/projects')
export class MyProjectsController {

	constructor(
		private translationService: TranslationService,
		private configService: ConfigService,
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository
	) {}

	@Get('/')
	@Render('my-projects')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.PROJECTS'))
	public async myProjects(@QueryParam('page') pageNumber: number, @QueryParam('search') search: string, @CurrentUser() user: User, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getProjectsPage(pageNumber, search, user, preferences.lang)),
			searchTerm: search,
			viewScript: 'my-projects-comps'
		};
	}

	@Get('/page')
	@Render('project-component-page')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async page(@QueryParam('page') pageNumber = 0, @QueryParam('search') search: string, @CurrentUser() user: User, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getProjectsPage(pageNumber, search, user, preferences.lang)),
			layout: false
		};
	}

	@Get('/info/:id')
	@Render('project-component-info-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async infoPopup(@Param('id') id: string, @CurrentUser() user: User, @Preferences() preferences: UserPreferences) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);
		const dependencies = await this.projectDepRepo.getDependencies(project);

		(project.lastEdited as any) = this.translationService.dateFormatDateTime(project.lastEdited, preferences.lang);
		(project.createdOn as any) = this.translationService.dateFormatDateTime(project.createdOn, preferences.lang);
		(project as any).previewDark = project.previewDark?.publicUrl ?? '/assets/default-preview.svg';
		(project as any).previewLight = project.previewLight?.publicUrl ?? '/assets/default-preview.svg';
		(project as any).communityUrl = 'community/project/' + project.link;

		const forkedFrom = await project.forkedFrom;
		if (forkedFrom) {
			(project as any).forkedFromName = (await forkedFrom.user).username + '/' + forkedFrom.name;
			(project as any).forkedFromUrl = 'community/project/' + forkedFrom.link;
		}

		return {
			...project,
			dependencies,
			layout: false,
			type: 'project'
		};
	}

	@Get('/edit-popup/:id')
	@Render('project-component-edit-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async editPopup(@Param('id') id: string, @CurrentUser() user: User) {
		return {
			...(await this.projectRepo.getOwnedProjectOrThrow(id, user)),
			action: '/my/projects/edit/',
			type: 'project',
			layout: false
		};
	}

	@Post('/edit/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware(request => `/my/projects/edit-popup/${request.params.id}`))
	public async edit(@Param('id') id: string, @CurrentUser() user: User, @Body() body: EditProject) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);
		project.name = body.name;
		project.description = body.description;
		await this.projectRepo.save(project);
		return {
			id: project.id
		};
	}

	@Get('/create-popup')
	@Render('project-component-create-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public createPopup() {
		return {
			action: '/my/projects/create',
			type: 'project',
			layout: false
		};
	}

	@Post('/create')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware(() => '/my/projects/create-popup'))
	public async create(@CurrentUser() user: User, @Body() body: CreateProject) {
		const project = await this.projectRepo.createProjectForUser(body.name, body.description, body.public === 'on', user);
		return {
			id: project.id
		};
	}

	@Get('/delete-popup/:id')
	@Render('project-component-delete-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async deletePopup(@Param('id') id: string, @CurrentUser() user: User) {
		return {
			...(await this.projectRepo.getOwnedProjectOrThrow(id, user)),
			action: '/my/projects/delete/',
			type: 'project',
			layout: false
		};
	}

	@Post('/delete/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async delete(@Param('id') id: string, @CurrentUser() user: User) {
		const project = await this.projectRepo.deleteProjectForUser(id, user);
		return {
			id: project.id
		};
	}

	@Get('/share-popup/:id')
	@Render('project-component-share-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async sharePopup(@Param('id') id: string, @CurrentUser() user: User) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);

		return {
			public: project.public,
			id: project.id,
			shareLink: `${this.configService.getConfig('domains').editor}/share/${project.link}`,
			action: '/my/projects/share/',
			regenerateAction: '/my/projects/regenerate-link/',
			type: 'project',
			layout: false
		};
	}

	@Post('/share/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async share(@Param('id') id: string, @CurrentUser() user: User, @Body() body: ShareProject) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);
		project.public = body.public === 'on';
		await this.projectRepo.save(project);

		return {
			id: project.id
		};
	}

	@Post('/regenerate-link/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async regenerateLink(@Param('id') id: string, @CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(id, user);
		project.link = uuid();
		await this.projectRepo.save(project);

		return redirect({
			target: `/my/projects/share-popup/${id}`
		});
	}

	private async getProjectsPage(pageNumber: number, search: string, user: User, language: string): Promise<any> {
		const page = await this.projectRepo.getProjectPageForUser(pageNumber ?? 0, 8, user, search);

		const entries = page.entries.map(entry => {
			const transformed = classToPlain(entry);
			transformed.lastEdited = this.translationService.dateFormatDate(entry.lastEdited, language);
			transformed.editorUrl = this.configService.getConfig('domains').editor + '/project/' + entry.id;
			transformed.previewDark = entry.previewDark?.publicUrl ?? '/assets/default-preview.svg';
			transformed.previewLight = entry.previewLight?.publicUrl ?? '/assets/default-preview.svg';
			return transformed;
		});
		return {
			entries,
			currentPage: page.page,
			totalPages: page.total
		};
	}
}
