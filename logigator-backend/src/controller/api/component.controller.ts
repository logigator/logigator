import {
	BadRequestError,
	Body,
	CurrentUser,
	Delete,
	Get,
	HttpCode,
	JsonController,
	Param,
	Patch,
	Post,
	Put,
	QueryParam,
	ResponseClassTransformOptions,
	UploadedFiles,
	UseBefore,
	UseInterceptor
} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {CheckAuthenticatedApiMiddleware} from '../../middleware/auth/api-guards/check-authenticated-api.middleware';
import {User} from '../../database/entities/user.entity';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ComponentRepository} from '../../database/repositories/component.repository';
import {CreateComponent} from '../../models/request/shared/create-component';
import {ProjectElement} from '../../models/request/api/project-element';
import {classToPlain} from 'class-transformer';
import {ComponentDependencyRepository} from '../../database/repositories/component-dependency.repository';
import {ComponentFile} from '../../database/entities/component-file.entity';
import {SaveComponent} from '../../models/request/api/component/save-component';
import {UpdateComponent} from '../../models/request/api/component/update-component';
import {v4 as uuid} from 'uuid';
import {getUploadedFileOptions} from '../../functions/get-uploaded-file-options';
import {ComponentPreviewDark} from '../../database/entities/component-preview-dark.entity';
import {ComponentPreviewLight} from '../../database/entities/component-preview-light.entity';
import {ShareCloningService} from '../../services/share-cloning.service';

@JsonController('/api/component')
@UseInterceptor(ApiInterceptor)
export class ComponentController {
	constructor (
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private componentDepRepo: ComponentDependencyRepository,
		private shareCloningService: ShareCloningService
	) {}

	@Get('/')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public async list(@CurrentUser() user: User, @QueryParam('page') pageNr: number, @QueryParam('size') pageSize: number, @QueryParam('search') search: string) {
		if (pageNr !== undefined || pageSize !== undefined || search !== undefined)
			return this.componentRepo.getComponentPageForUser(pageNr, pageSize, user, search);

		return this.componentRepo.find({
			where: {
				user
			}
		});
	}

	@Post('/')
	@HttpCode(201)
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public create(@Body() body: CreateComponent, @CurrentUser() user: User) {
		return this.componentRepo.createComponentForUser(body.name, body.symbol, body.description, body.public === 'true', user);
	}

	@Get('/:componentId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async open(@Param('componentId') componentId: string, @CurrentUser() user: User) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(componentId, user);
		const dependencies = await this.componentDepRepo.find({
			where: {
				dependent: component
			}
		});

		const contentBuffer = await component.elementsFile?.getFileContent();
		const content: ProjectElement[] = contentBuffer?.length ? JSON.parse(contentBuffer.toString()) : [];

		return {
			...classToPlain(component),
			dependencies,
			elements: content ?? []
		};
	}

	@Put('/:componentId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async save(@Param('componentId') componentId: string, @CurrentUser() user: User, @Body() body: SaveComponent) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(componentId, user);

		if (component.elementsFile && component.elementsFile.hash !== body.oldHash)
			throw new BadRequestError('VersionMismatch');

		if (!component.elementsFile)
			component.elementsFile = new ComponentFile();

		component.elementsFile.setFileContent(JSON.stringify(body.elements));
		component.numInputs = body.numInputs;
		component.numOutputs = body.numOutputs;
		component.labels = body.labels;
		component.lastEdited = new Date();

		const deps = [];
		const depSet = new Set<string>();
		for (const mapping of body.dependencies) {
			const depComp = await this.componentRepo.getOwnedComponentOrThrow(mapping.id, user, `Component for mapping '${mapping.id}' not found.`);
			const dep = this.componentDepRepo.create();
			dep.dependency = depComp;
			dep.dependent = component;
			dep.model_id = mapping.model;
			depSet.add(dep.dependency.id);
			deps.push(dep);
		}

		await this.componentDepRepo.remove(
			(await this.componentDepRepo.find({dependent: component}))
				.filter(x => !depSet.has(x.dependency.id))
		);
		await this.componentDepRepo.save(deps);
		return this.componentRepo.save(component);
	}

	@Post('/:componentId/preview')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async updatePreviews(@Param('componentId') componentId: string, @CurrentUser() user: User, @UploadedFiles('previews', {options: getUploadedFileOptions(2), required: true}) images: any) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(componentId, user);
		if (images[0].mimetype !== 'image/png' || images[1].mimetype !== 'image/png')
			throw new BadRequestError('Invalid MIME type');

		if (!component.previewDark)
			component.previewDark = new ComponentPreviewDark();
		if (!component.previewLight)
			component.previewLight = new ComponentPreviewLight();

		component.previewDark.setFileContent(images[0].buffer);
		component.previewLight.setFileContent(images[1].buffer);

		return this.componentRepo.save(component);
	}

	@Delete('/:componentId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async delete(@Param('componentId') componentId: string, @CurrentUser() user: User) {
		return await this.componentRepo.deleteComponentForUser(componentId, user);
	}

	@Patch('/:componentId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async update(@Param('componentId') componentId: string, @CurrentUser() user: User, @Body() body: UpdateComponent) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(componentId, user);

		if (body.name)
			component.name = body.name;
		if (body.description)
			component.description = body.description;
		if (body.symbol)
			component.symbol = body.symbol;
		if (body.public)
			component.public = body.public;
		if (body.updateLink)
			component.link = uuid();

		return this.componentRepo.save(component);
	}

	@Get('/clone/:link')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public clone(@Param('link') link: string, @CurrentUser() user: User) {
		return this.shareCloningService.cloneComponent(link, user);
	}
}
