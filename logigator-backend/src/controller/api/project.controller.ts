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
import {CheckAuthenticatedApiMiddleware} from '../../middleware/auth/api-guards/check-authenticated-api.middleware';
import {CreateProject} from '../../models/request/shared/create-project';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {User} from '../../database/entities/user.entity';
import {ProjectFile} from '../../database/entities/project-file.entity';
import {SaveProject} from '../../models/request/api/project/save-project';
import {UpdateProject} from '../../models/request/api/project/update-project';
import {ProjectDependencyRepository} from '../../database/repositories/project-dependency.repository';
import {classToPlain} from 'class-transformer';
import {ComponentRepository} from '../../database/repositories/component.repository';
import {ProjectElement} from '../../models/request/api/project-element';
import {v4 as uuid} from 'uuid';
import {getUploadedFileOptions} from '../../functions/get-uploaded-file-options';
import {ProjectPreviewDark} from '../../database/entities/project-preview-dark.entity';
import {ProjectPreviewLight} from '../../database/entities/project-preview-light.entity';
import {ShareCloningService} from '../../services/share-cloning.service';

@JsonController('/api/project')
@UseInterceptor(ApiInterceptor)
export class ProjectController {

	constructor (
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository,
		private shareCloningService: ShareCloningService
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
		return this.projectRepo.createProjectForUser(body.name, body.description, body.public === 'true', user);
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
		project.lastEdited = new Date();

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

		await this.projectDepRepo.save(deps);
		return this.projectRepo.save(project);
	}

	@Post('/:projectId/preview')
	@UseBefore(CheckAuthenticatedApiMiddleware)
	public async updatePreviews(@Param('projectId') projectId: string, @CurrentUser() user: User, @UploadedFiles('previews', {options: getUploadedFileOptions(2), required: true}) images: any) {
		const project = await this.projectRepo.getOwnedProjectOrThrow(projectId, user);
		if (images[0].mimetype !== 'image/png' || images[1].mimetype !== 'image/png')
			throw new BadRequestError('Invalid MIME type');

		if (!project.previewDark)
			project.previewDark = new ProjectPreviewDark();
		if (!project.previewLight)
			project.previewLight = new ProjectPreviewLight();

		project.previewDark.setFileContent(images[0].buffer);
		project.previewLight.setFileContent(images[1].buffer);

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
	public clone(@Param('link') link: string, @CurrentUser() user: User) {
		return this.shareCloningService.cloneProject(link, user);
	}
}
