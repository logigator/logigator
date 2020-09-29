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
import {Project} from '../../database/entities/project.entity';
import {UpdateProject} from '../../models/request/api/project/update-project';
import {Like} from 'typeorm';
import {Component} from '../../database/entities/component.entity';
import {ComponentDependency} from '../../database/entities/component-dependency.entity';
import {ProjectDependencyRepository} from '../../database/repositories/project-dependency.repository';
import {classToPlain} from 'class-transformer';

@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {

	constructor (
		@InjectRepository() private projectRepo: ProjectRepository,
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
	public create(@Body() body: CreateProject, @CurrentUser() user: User) {
		const project = this.projectRepo.create();
		project.name = body.name;
		project.description = body.description;
		project.user = Promise.resolve(user);
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

		const rawContent = await project.projectFile?.getFileContent();
		const content: ProjectFile = rawContent ? JSON.parse(rawContent.toString()) : {elements: []};

		return {
			...classToPlain(project),
			mappings: dependencies,
			...content
		};
	}

	@Put('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async save(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: SaveProject) {
		let project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);

		if (project.projectFile && project.projectFile.md5 !== body.oldHash)
			throw new BadRequestError('VersionMismatch');

		if (!project.projectFile)
			project.projectFile = new ProjectFile();

		project.projectFile.mimeType = 'application/json';
		project.projectFile.setFileContent(JSON.stringify(body.project));
		project = await this.projectRepo.save(project);
		return {
			id: project.id,
			hash: project.projectFile.md5
		};
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
		// TODO
	}

	private async getProjectDependencies(
		project: Project | Component,
		deps = new Map<string, ComponentDependency>()
	): Promise<Map<string, ComponentDependency>> {
		const dependencies = (await project.dependencies as ComponentDependency[]);
		for (const dependency of dependencies) {
			if (deps.has(dependency.dependency.id)) {
				continue;
			}
			deps.set(dependency.dependency.id, dependency);
			deps = await this.getProjectDependencies(dependency.dependency, deps);
		}
		return deps;
	}
}
