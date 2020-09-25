import {
	Body,
	CurrentUser,
	Get,
	HttpCode,
	JsonController, NotFoundError,
	Param,
	Post,
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

@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {

	constructor (
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private userRepo: UserRepository
	) {}

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
		const project = await this.projectRepo.findOne({
			where: {
				id: projectId,
				user: user
			}
		});
		if (!project)
			throw new NotFoundError('ResourceNotFound');
		return await project.projectFile?.getFileContent();
	}
}
