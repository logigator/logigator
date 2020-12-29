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
import {ShareProject} from '../../../models/request/frontend/my-projects/share-project';
import {Redirect, RedirectFunction} from '../../../decorator/redirect.decorator';
import {v4 as uuid} from 'uuid';
import {ConfigService} from '../../../services/config.service';
import {classToPlain} from 'class-transformer';

@Controller('/my/components')
export class MyComponentsController {

	constructor(
		private translationService: TranslationService,
		private configService: ConfigService,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private componentDepRepo: ComponentDependencyRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository
	) {}

	@Get('/')
	@Render('my-components')
	@UseBefore(CheckAuthenticatedFrontMiddleware, setTitleMiddleware('TITLE.COMPONENTS'))
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
		const dependencies = await this.componentDepRepo.getDependencies(component);
		const componentDependents = await this.componentDepRepo.getDependents(component);
		const projectDependents = await this.projectDepRepo.getDependents(component);


		(component.lastEdited as any) = this.translationService.dateFormatDateTime(component.lastEdited, preferences.lang);
		(component.createdOn as any) = this.translationService.dateFormatDateTime(component.lastEdited, preferences.lang);
		(component as any).previewDark = component.previewDark?.publicUrl ?? '/assets/default-preview.svg';
		(component as any).previewLight = component.previewLight?.publicUrl ?? '/assets/default-preview.svg';
		(component as any).communityUrl = 'community/component/' + component.link;

		const forkedFrom = await component.forkedFrom;
		if (forkedFrom) {
			(component as any).forkedFromName = (await forkedFrom.user).username + '/' + forkedFrom.name;
			(component as any).forkedFromUrl = 'community/project/' + forkedFrom.link;
		}

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
		const component = await this.componentRepo.createComponentForUser(body.name, body.symbol, body.description, body.public === 'on', user);
		return {
			id: component.id
		};
	}

	@Get('/delete-popup/:id')
	@Render('project-component-delete-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async deletePopup(@Param('id') id: string, @CurrentUser() user: User) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(id, user);
		const componentDependents = (await this.componentDepRepo.getDependents(component)).map(dep => dep.name).join(', ');
		const projectDependents = (await this.projectDepRepo.getDependents(component)).map(dep => dep.name).join(', ');

		return {
			...component,
			componentDependents,
			projectDependents,
			hasDependents: projectDependents || componentDependents,
			action: '/my/components/delete/',
			type: 'component',
			layout: false
		};
	}

	@Post('/delete/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async delete(@Param('id') id: string, @CurrentUser() user: User) {
		const component = await this.componentRepo.deleteComponentForUser(id, user);
		return {
			id: component.id
		};
	}

	@Get('/share-popup/:id')
	@Render('project-component-share-popup')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async sharePopup(@Param('id') id: string, @CurrentUser() user: User) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(id, user);

		return {
			public: component.public,
			id: component.id,
			shareLink: `${this.configService.getConfig('domains').editor}/share/${component.link}`,
			action: '/my/components/share/',
			regenerateAction: '/my/components/regenerate-link/',
			type: 'component',
			layout: false
		};
	}

	@Post('/share/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async share(@Param('id') id: string, @CurrentUser() user: User, @Body() body: ShareProject) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(id, user);
		component.public = body.public === 'on';
		await this.componentRepo.save(component);

		return {
			id: component.id
		};
	}

	@Post('/regenerate-link/:id')
	@ContentType('application/json')
	@UseBefore(CheckAuthenticatedFrontMiddleware)
	public async regenerateLink(@Param('id') id: string, @CurrentUser() user: User, @Redirect() redirect: RedirectFunction) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(id, user);
		component.link = uuid();
		await this.componentRepo.save(component);

		return redirect({
			target: `/my/components/share-popup/${id}`
		});
	}

	private async getComponentsPage(pageNumber: number, search: string, user: User, language: string): Promise<any> {
		const page = await this.componentRepo.getComponentPageForUser(pageNumber ?? 0, 12, user, search);

		const entries = page.entries.map(entry => {
			const transformed = classToPlain(entry);
			transformed.lastEdited= this.translationService.dateFormatDate(entry.lastEdited, language);
			transformed.editorUrl = this.configService.getConfig('domains').editor + '/component/' + entry.id;
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
