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
import {CreateProject} from '../../models/request/api/project/create-project';
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
import {ProjectElement} from '../../models/request/api/project/project-element';

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
		const project = this.projectRepo.create();
		project.name = body.name;
		project.description = body.description;
		project.user = Promise.resolve(user);
		project.projectFile = new ProjectFile();
		return this.projectRepo.save(project);
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

		const contentBuffer = await project.projectFile?.getFileContent();
		const content: ProjectElement[] = contentBuffer?.length ? JSON.parse(contentBuffer.toString()) : [];

		return {
			...classToPlain(project),
			mappings: dependencies,
			elements: content ?? []
		};
	}

	@Put('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async save(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: SaveProject) {
		let project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);

		if (project.projectFile && project.projectFile.hash !== body.oldHash)
			throw new BadRequestError('VersionMismatch');

		if (!project.projectFile)
			project.projectFile = new ProjectFile();

		project.projectFile.setFileContent(JSON.stringify(body.elements));

		const deps = [];
		const depSet = new Set<string>();
		for (const mapping of body.mappings) {
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
		project = await this.projectRepo.save(project);

		return project;
	}

	@Delete('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async delete(@Param('projectId') projectId: string, @CurrentUser() user: User) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);

		await this.projectRepo.remove(project);
		return {
			id: project.id
		};
	}

	@Patch('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async update(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: UpdateProject) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);

		if (body.name)
			project.name = body.name;
		if (body.description)
			project.description = body.description;

		await this.projectRepo.save(project);
		return {
			id: project.id
		};
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

		const cloned = this.projectRepo.create();
		cloned.name = project.name;
		cloned.description = project.description;
		cloned.user = Promise.resolve(user);
		cloned.projectFile = new ProjectFile();
		cloned.projectFile.setFileContent(await project.projectFile.getFileContent());
		// return this.projectRepo.save(cloned);


		// TODO
	}
}
