import {EntityRepository} from 'typeorm';
import {Service} from 'typedi';
import {Project} from '../entities/project.entity';
import {PageableRepository} from './pageable.repository';
import {User} from '../entities/user.entity';
import {NotFoundError} from 'routing-controllers';

@Service()
@EntityRepository(Project)
export class ProjectRepository extends PageableRepository<Project> {

	public async getOwnedProjectOrThrow(projectId: string, user: User): Promise<Project> {
		const project = await this.findOne({
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
