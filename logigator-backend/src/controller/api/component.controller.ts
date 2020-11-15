import {
	BadRequestError,
	Body,
	CurrentUser, Delete,
	Get, HttpCode,
	JsonController, NotFoundError, Param, Patch, Post, Put, QueryParam,
	ResponseClassTransformOptions, UploadedFile,
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
import {Transaction, TransactionRepository} from 'typeorm';
import {Component} from '../../database/entities/component.entity';
import {ProjectRepository} from '../../database/repositories/project.repository';
import {v4 as uuid} from 'uuid';
import {getUploadedFileOptions} from '../../functions/get-uploaded-file-options';
import {ComponentPreviewDark} from '../../database/entities/component-preview-dark.entity';
import {ComponentPreviewLight} from '../../database/entities/component-preview-light.entity';

@JsonController('/api/component')
@UseInterceptor(ApiInterceptor)
export class ComponentController {
	constructor (
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private componentDepRepo: ComponentDependencyRepository
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
		return this.componentRepo.createComponentForUser(body.name, body.symbol, body.description, user);
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

	@Post('/:componentId/preview-dark')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async updatePreviewDark(@Param('componentId') componentId: string, @CurrentUser() user: User, @UploadedFile('preview', {options: getUploadedFileOptions(), required: true}) image) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(componentId, user);
		if (image.mimetype !== 'image/png')
			throw new BadRequestError('Invalid MIME type');

		if (!component.previewDark)
			component.previewDark = new ComponentPreviewDark();
		component.previewDark.setFileContent(image.buffer);

		return this.componentRepo.save(component);
	}

	@Post('/:componentId/preview-light')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async updatePreviewLight(@Param('componentId') componentId: string, @CurrentUser() user: User, @UploadedFile('preview', {options: getUploadedFileOptions(), required: true}) image) {
		const component = await this.componentRepo.getOwnedComponentOrThrow(componentId, user);
		if (image.mimetype !== 'image/png')
			throw new BadRequestError('Invalid MIME type');

		if (!component.previewLight)
			component.previewLight = new ComponentPreviewLight();
		component.previewLight.setFileContent(image.buffer);

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
	public async clone(@Param('link') link: string, @CurrentUser() user: User) {
		const component = await this.componentRepo.findOne({
			where: {
				link
			}
		});
		if (!component)
			throw new NotFoundError('ResourceNotFound');

		const dependencies = await this.componentDepRepo.getDependencies(component, true);
		const clonedProjects = await this.cloneTransaction([component, ...dependencies], user);
		return Array.from(clonedProjects.values());
	}

	@Transaction()
	private async cloneTransaction(
		dependencies: Component[],
		user: User,
		@TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
		@TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
		@TransactionRepository(ComponentDependencyRepository) compDepRepo?: ComponentDependencyRepository
	) {
		const map = new Map<string, Component>();
		for (const dep of dependencies) {
			map.set(dep.id, await compRepo.clone(dep, user));
		}

		for (const comp of map) {
			const deps = (await compDepRepo.find({
				where: {
					dependent: comp[0]
				}
			})).map(x => {
				const dep = compDepRepo.create();
				dep.dependency = map.get(x.dependency.id);
				dep.model_id = x.model_id;
				return dep;
			});
			comp[1].dependencies = Promise.resolve(deps);
			await compRepo.save(comp[1]);
		}

		return map;
	}
}
