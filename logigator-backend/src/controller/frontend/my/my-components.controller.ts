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
import {User} from '../../../database/entities/user.entity';
import {Preferences} from '../../../decorator/preferences.decorator';
import {UserPreferences} from '../../../models/user-preferences';
import {formErrorMiddleware} from '../../../middleware/action/form-error.middleware';
import {ComponentRepository} from '../../../database/repositories/component.repository';
import {ComponentDependencyRepository} from '../../../database/repositories/component-dependency.repository';
import {CreateComponent} from '../../../models/request/shared/create-component';
import {EditComponent} from '../../../models/request/frontend/my-components/edit-component';
import {ProjectDependencyRepository} from '../../../database/repositories/project-dependency.repository';

@Controller('/my/components')
export class MyComponentsController {

	constructor(
		private translationService: TranslationService,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private componentDepRepo: ComponentDependencyRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository
	) {}

	@Get('/')
	@Render('my-components')
	@UseBefore(setTitleMiddleware('TITLE.COMPONENTS'))
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async myComponents(@QueryParam('page') pageNumber: number, @QueryParam('search') search: string, @CurrentUser() user: User, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getComponentsPage(pageNumber, search, user, preferences.lang)),
			searchTerm: search,
			viewScript: 'my-projects-comps'
		};
	}

	@Get('/page')
	@Render('project-component-page')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async page(@QueryParam('page') pageNumber = 0, @QueryParam('search') search: string, @CurrentUser() user: User, @Preferences() preferences: UserPreferences) {
		return {
			...(await this.getComponentsPage(pageNumber, search, user, preferences.lang)),
			layout: false
		};
	}

	@Get('/info/:id')
	@Render('project-component-info-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async infoPopup(@Param('id') id: string, @CurrentUser() user: User, @Preferences() preferences: UserPreferences) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(id, user);
		const dependencies = (await this.componentDepRepo.getDependencies(component)).map(dep => dep.name).join(', ');
		const componentDependents = (await this.componentDepRepo.getDependents(component)).map(dep => dep.name).join(', ');
		const projectDependents = (await this.projectDepRepo.getDependents(component)).map(dep => dep.name).join(', ');


		(component.lastEdited as any) = this.translationService.dateFormatDateTime(component.lastEdited, preferences.lang);
		(component.createdOn as any) = this.translationService.dateFormatDateTime(component.lastEdited, preferences.lang);

		return {
			...component,
			dependencies,
			componentDependents,
			projectDependents,
			layout: false,
			type: 'component'
		};
	}

	@Get('/edit-popup/:id')
	@Render('project-component-edit-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async editPopup(@Param('id') id: string, @CurrentUser() user: User) {
		return {
			...(await this.componentRepo.getOwnedComponentOrThrow(id, user)),
			action: '/my/components/edit/',
			type: 'component',
			layout: false
		};
	}

	@Post('/edit/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware(request => `/my/components/edit-popup/${request.params.id}`))
	public async edit(@Param('id') id: string, @CurrentUser() user: User, @Body() body: EditComponent) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(id, user);
		component.name = body.name;
		component.symbol = body.symbol;
		component.description = body.description;
		await this.componentRepo.save(component);
		return {
			id: component.id
		};
	}

	@Get('/create-popup')
	@Render('project-component-create-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public createPopup() {
		return {
			action: '/my/components/create',
			type: 'component',
			layout: false
		};
	}

	@Post('/create')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	@UseAfter(formErrorMiddleware(() => '/my/components/create-popup'))
	public async create(@CurrentUser() user: User, @Body() body: CreateComponent) {
		const component = await this.componentRepo.createComponentForUser(body.name, body.symbol, body.description, user);
		return {
			id: component.id
		};
	}

	private async getComponentsPage(pageNumber: number, search: string, user: User, language: string): Promise<any> {
		const page = await this.componentRepo.getComponentPageForUser(pageNumber ?? 0, 12, user, search);

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
