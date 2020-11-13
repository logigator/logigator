import {
	BadRequestError,
	Body,
	CurrentUser, Delete,
	Get,
	HttpCode,
	JsonController, NotFoundError,
	Param, Patch,
	Post, Put, QueryParam, ResponseClassTransformOptions,
	UseBefore,
	UseInterceptor
} from 'routing-controllers';
import {CheckAuthenticatedApiMiddleware} from '../../middleware/auth/api-guards/check-authenticated-api.middleware';
import {CreateProject} from '../../models/request/shared/create-project';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {User} from '../../database/entities/user.entity';
import {UserRepository} from '../../database/repositories/user.repository';
import {ProjectFile} from '../../database/entities/project-file.entity';
import {SaveProject} from '../../models/request/api/project/save-project';
import {UpdateProject} from '../../models/request/api/project/update-project';
import {ProjectDependencyRepository} from '../../database/repositories/project-dependency.repository';
import {classToPlain} from 'class-transformer';
import {ComponentRepository} from '../../database/repositories/component.repository';
import {ProjectElement} from '../../models/request/api/project-element';
import {Transaction, TransactionRepository} from 'typeorm';
import {Component} from '../../database/entities/component.entity';
import {ComponentDependencyRepository} from '../../database/repositories/component-dependency.repository';
import {Project} from '../../database/entities/project.entity';
import {v4 as uuid} from 'uuid';

@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {

	constructor (
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository
	) {}

	@Get('/')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public async list(@CurrentUser() user: User, @QueryParam('page') pageNr: number, @QueryParam('size') pageSize: number, @QueryParam('search') search: string) {
		return this.projectRepo.getProjectPageForUser(pageNr, pageSize, user, search);
	}

	@Post('/')
	@HttpCode(201)
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public create(@Body() body: CreateProject, @CurrentUser() user: User) {
		return this.projectRepo.createProjectForUser(body.name, body.description, user);
	}

	@Get('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async open(@Param('projectId') projectId: string, @CurrentUser() user: User) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);
		const dependencies = await this.projectDepRepo.find({
			where: {
				dependent: project
			}
		});

		const contentBuffer = await project.elementsFile?.getFileContent();
		const content: ProjectElement[] = contentBuffer?.length ? JSON.parse(contentBuffer.toString()) : [];

		return {
			...classToPlain(project, {groups: ['showShareLinks']}),
			dependencies,
			elements: content ?? []
		};
	}

	@Put('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async save(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: SaveProject) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);

		if (project.elementsFile && project.elementsFile.hash !== body.oldHash)
			throw new BadRequestError('VersionMismatch');

		if (!project.elementsFile)
			project.elementsFile = new ProjectFile();

		project.elementsFile.setFileContent(JSON.stringify(body.elements));

		const deps = [];
		const depSet = new Set<string>();
		for (const mapping of body.dependencies) {
			const depComp = await this.componentRepo.getOwnedComponentOrThrow(mapping.id, user, `Component for mapping '${mapping.id}' not found.`);
			const dep = this.projectDepRepo.create();
			dep.dependency = depComp;
			dep.dependent = project;
			dep.model_id = mapping.model;
			depSet.add(dep.dependency.id);
			deps.push(dep);
		}

		await this.projectDepRepo.remove(
			(await this.projectDepRepo.find({dependent: project}))
				.filter(x => !depSet.has(x.dependency.id))
		);

		project.dependencies = Promise.resolve(deps);
		return this.projectRepo.save(project);
	}

	@Delete('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async delete(@Param('projectId') projectId: string, @CurrentUser() user: User) {
		return this.projectRepo.deleteProjectForUser(projectId, user);
	}

	@Patch('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public async update(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: UpdateProject) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);

		if (body.name)
			project.name = body.name;
		if (body.description)
			project.description = body.description;
		if (body.public)
			project.public = body.public;
		if (body.updateLink)
			project.link = uuid();

		return this.projectRepo.save(project);
	}

	@Get('/clone/:link')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async clone(@Param('link') link: string, @CurrentUser() user: User) {
		const project = await this.projectRepo.findOne({
			where: {
				link
			}
		});
		if (!project)
			throw new NotFoundError('ResourceNotFound');

		const dependencies = await this.projectDepRepo.getDependencies(project, true);
		const clonedProjects = await this.cloneTransaction(project, dependencies, user);
		return Array.from(clonedProjects.values());
	}

	@Transaction()
	private async cloneTransaction(
		project: Project,
		dependencies: Component[],
		user: User,
		@TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
		@TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
		@TransactionRepository(ComponentDependencyRepository) compDepRepo?: ComponentDependencyRepository,
		@TransactionRepository(ProjectDependencyRepository) projDepRepo?: ProjectDependencyRepository
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

		const cloned = projRepo.create();
		cloned.name = project.name;
		cloned.description = project.description;
		cloned.user = Promise.resolve(user);
		cloned.forkedFrom = Promise.resolve(project);
		cloned.createdOn = project.createdOn;
		cloned.elementsFile = new ProjectFile();
		if (project.elementsFile) cloned.elementsFile.setFileContent(await project.elementsFile.getFileContent());
		const deps = (await projDepRepo.find({
			where: {
				dependent: project
			}
		})).map(x => {
			const dep = projDepRepo.create();
			dep.dependency = map.get(x.dependency.id);
			dep.model_id = x.model_id;
			return dep;
		});
		cloned.dependencies = Promise.resolve(deps);
		await projRepo.save(cloned);

		return map;
	}
}
