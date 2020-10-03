import {EntityRepository, Like} from 'typeorm';
import {Service} from 'typedi';
import {Project} from '../entities/project.entity';
import {Page, PageableRepository} from './pageable.repository';
import {User} from '../entities/user.entity';
import {NotFoundError} from 'routing-controllers';
import {ProjectFile} from '../entities/project-file.entity';

@Service()
@EntityRepository(Project)
export class ProjectRepository extends PageableRepository<Project> {

	public async getOwnedProjectOrThrow(projectId: string, user: User, message = 'ResourceNotFound'): Promise<Project> {
		const project = await this.findOne({
			where: {
				id: projectId,
				user: user
			}
		});
		if (!project)
			throw new NotFoundError(message);
		return project;
	}

	public async getProjectPageForUser(pageNr: number, pageSize: number, user: User, search?: string): Promise<Page<Project>> {
		return this.getPage(pageNr, pageSize, {
			where: {
				user: user,
				...(search && {name: Like('%' + search + '%')})
			},
			order: {
				lastEdited: 'DESC'
			}
		});
	}

	public async createProjectForUser(name: string, description: string, user: User) {
		const project = this.create();
		project.name = name;
		project.description = description;
		project.user = Promise.resolve(user);
		project.projectFile = new ProjectFile();
		return this.save(project);
	}

	public async deleteProjectForUser(projectId: string, user: User): Promise<Project> {
		const project = await this.getOwnedProjectOrThrow(projectId, user);
		await this.remove(project);
		return project;
	}

}
