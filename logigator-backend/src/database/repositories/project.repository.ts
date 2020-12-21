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

	public async getProjectWithStargazersCountByLink(link: string): Promise<Project> {
		return await this.createQueryBuilder('project')
			.loadRelationCountAndMap('project.stargazersCount', 'project.stargazers')
			.where('project.link = :link', {link})
			.getOne();
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

	public async getSharedProjectPage(pageNr: number, pageSize: number, search?: string): Promise<Page<Project>> {
		return this.getPage(pageNr, pageSize, {
			where: {
				public: true,
				...(search && {name: Like('%' + search + '%')})
			},
			order: {
				lastEdited: 'DESC'
			}
		});
	}

	public async createProjectForUser(name: string, description: string, sharePublicly: boolean, user: User) {
		const project = this.create();
		project.name = name;
		project.description = description;
		project.public = sharePublicly;
		project.user = Promise.resolve(user);
		project.elementsFile = new ProjectFile();
		return this.save(project);
	}

	public async deleteProjectForUser(projectId: string, user: User): Promise<Project> {
		const project = await this.getOwnedProjectOrThrow(projectId, user);
		await this.remove(project);
		return project;
	}

	public async hasUserStaredProject(project: Project, user: User): Promise<boolean> {
		const count = await this.createQueryBuilder('project')
			.leftJoin('project.stargazers', 'user')
			.where('project.id = :projectId', {projectId: project.id})
			.andWhere('user.id = :userId', {userId: user.id})
			.limit(1)
			.getCount();
		return Boolean(count);
	}

	public async getStargazersCount(project: Project): Promise<number> {
		return (await this.createQueryBuilder('project')
			.select(['COUNT(project.id) AS count'])
			.innerJoin('project.stargazers', 'user')
			.where('project.id = :id', {id: project.id})
			.getRawOne()).count;
	}

}
