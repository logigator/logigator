import {
	BadRequestError,
	Body,
	CurrentUser, Delete,
	Get,
	HttpCode,
	JsonController, NotFoundError,
	Param, Patch,
	Post, Put, QueryParam,
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

@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {

	constructor (
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private userRepo: UserRepository
	) {}

	@Get('/')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async list(@CurrentUser() user: User, @QueryParam('page') pageNr: number, @QueryParam('size') pageSize: number) {
		const page = await this.projectRepo.getPage(pageNr, pageSize, {
			where: {
				user: user
			}
		});
		return page.entries.map(entry => {
			(entry.projectFile as any) = entry.projectFile?.publicUrl;
			return entry;
		});
	}

	@Post('/')
	@HttpCode(201)
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async create(@Body() body: CreateProject, @CurrentUser() user: User) {
		const project = this.projectRepo.create();
		project.name = body.name;
		project.description = body.description;
		project.user = Promise.resolve(user);
		return {
			id: (await this.projectRepo.save(project)).id
		};
	}

	@Get('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async open(@Param('projectId') projectId: string, @CurrentUser() user: User) {
		const project = await this.getOwnedProjectOrThrow(projectId, user);

		const content = await project.projectFile?.getFileContent();
		if (!content)
			return {};
		return JSON.parse(content.toString());
	}

	@Put('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async save(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: SaveProject) {
		const project = await this.getOwnedProjectOrThrow(projectId, user);

		if (project.version !== body.version)
			throw new BadRequestError('VersionMismatch');

		if (!project.projectFile)
			project.projectFile = new ProjectFile();

		project.projectFile.mimeType = 'application/json';
		project.projectFile.setFileContent(JSON.stringify(body));
		await this.projectRepo.save(project);
		return {
			id: project.id
		};
	}

	@Delete('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async delete(@Param('projectId') projectId: string, @CurrentUser() user: User) {
		const project = await this.getOwnedProjectOrThrow(projectId, user);

		await this.projectRepo.remove(project);
		return {
			id: project.id
		};
	}

	@Patch('/:projectId')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async update(@Param('projectId') projectId: string, @CurrentUser() user: User, @Body() body: UpdateProject) {
		const project = await this.getOwnedProjectOrThrow(projectId, user);

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

	private async getOwnedProjectOrThrow(projectId: string, user: User): Promise<Project> {
		const project = await this.projectRepo.findOne({
			where: {
				id: projectId,
				user: user
			}
		});
		if (!project)
			throw new NotFoundError('ResourceNotFound');
		return project;
	}
}
