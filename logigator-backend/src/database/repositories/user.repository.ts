import {EntityRepository, Repository} from 'typeorm';
import {User} from '../entities/user.entity';
import {Service} from 'typedi';
import {Page} from './pageable.repository';

@Service()
@EntityRepository(User)
export class UserRepository extends Repository<User> {

	public async getStargazersForProjectByLink(link: string, page: number, pageSize: number): Promise<Page<User>> {
		const results = await this.createQueryBuilder('user')
			.leftJoin('user.staredProjects', 'project')
			.innerJoinAndSelect('user.image', 'image')
			.where('project.link = :link', {link})
			.skip(page * pageSize)
			.take(pageSize)
			.getManyAndCount();

		return {
			page,
			total: Math.ceil(results[1] / pageSize),
			count: results[0].length,
			entries: results[0]
		} as Page<User>;
	}

	public async getStargazersForComponentByLink(link: string, page: number, pageSize: number): Promise<Page<User>> {
		const results = await this.createQueryBuilder('user')
			.leftJoin('user.staredComponents', 'component')
			.innerJoinAndSelect('user.image', 'image')
			.where('component.link = :link', {link})
			.skip(page * pageSize)
			.take(pageSize)
			.getManyAndCount();

		return {
			page,
			total: Math.ceil(results[1] / pageSize),
			count: results[0].length,
			entries: results[0]
		} as Page<User>;
	}

	public async getUserOwningProject(projectId: string): Promise<User> {
		return this.createQueryBuilder('user')
			.leftJoin('user.projects', 'project')
			.innerJoinAndSelect('user.image', 'image')
			.where('project.id = :id', {id: projectId})
			.getOne();
	}

	public async getUserOwningComponent(componentId: string): Promise<User> {
		return this.createQueryBuilder('user')
			.leftJoin('user.components', 'component')
			.innerJoinAndSelect('user.image', 'image')
			.where('component.id = :id', {id: componentId})
			.getOne();
	}

}
