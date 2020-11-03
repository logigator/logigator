import {
	Get,
	JsonController, NotFoundError, Param, ResponseClassTransformOptions,
	UseInterceptor
} from 'routing-controllers';
import {ApiInterceptor} from '../../interceptors/api.interceptor';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../../database/repositories/project.repository';
import {ComponentRepository} from '../../database/repositories/component.repository';
import {UserRepository} from '../../database/repositories/user.repository';
import {ProjectDependencyRepository} from '../../database/repositories/project-dependency.repository';
import {classToPlain} from 'class-transformer';
import {ProjectElement} from '../../models/request/api/project-element';
import {Project} from '../../database/entities/project.entity';
import {ComponentDependencyRepository} from '../../database/repositories/component-dependency.repository';
import {Component} from '../../database/entities/component.entity';

@JsonController('/api/share')
@UseInterceptor(ApiInterceptor)
export class ShareController {
	constructor (
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository,
		@InjectRepository() private componentDepRepo: ComponentDependencyRepository
	) {}

	@Get('/:link')
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public async get(@Param('link') link: string) {
		const project = (await this.projectRepo.findOne({
			where: {
				link
			}
		})) || (await this.componentRepo.findOne({
			where: {
				link
			}
		}));
		if (!project)
			throw new NotFoundError('ResourceNotFound');

		const dependencies = await (project instanceof Project ? this.projectDepRepo : this.componentDepRepo).find({
			where: {
				dependent: project
			}
		});
		const contentBuffer = await project.elementsFile?.getFileContent();
		const content: ProjectElement[] = contentBuffer?.length ? JSON.parse(contentBuffer.toString()) : [];

		return {
			type: project instanceof Project ? 'project' : 'comp',
			...classToPlain(project),
			dependencies,
			elements: content ?? []
		};
	}

	@Get('/dependencies/:link')
	@ResponseClassTransformOptions({groups: ['showShareLinks']})
	public async getDependencies(@Param('link') link: string) {
		const project = (await this.projectRepo.findOne({
			where: {
				link
			}
		})) || (await this.componentRepo.findOne({
			where: {
				link
			}
		}));
		if (!project)
			throw new NotFoundError('ResourceNotFound');

		return {
			dependencies: project instanceof Project ?
				await this.projectDepRepo.getDependencies(project as Project, true) :
				await this.componentDepRepo.getDependencies(project as Component, true)
		};
	}
}
