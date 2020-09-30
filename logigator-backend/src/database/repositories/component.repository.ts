import {EntityRepository} from 'typeorm';
import {Service} from 'typedi';
import {Component} from '../entities/component.entity';
import {PageableRepository} from './pageable.repository';
import {User} from '../entities/user.entity';
import {NotFoundError} from 'routing-controllers';

@Service()
@EntityRepository(Component)
export class ComponentRepository extends PageableRepository<Component> {
	public async getOwnedComponentOrThrow(projectId: string, user: User, message = 'ResourceNotFound'): Promise<Component> {
		const component = await this.findOne({
			where: {
				id: projectId,
				user: user
			}
		});
		if (!component)
			throw new NotFoundError(message);
		return component;
	}
}
