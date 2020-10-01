import {EntityRepository, Like} from 'typeorm';
import {Service} from 'typedi';
import {Component} from '../entities/component.entity';
import {Page, PageableRepository} from './pageable.repository';
import {User} from '../entities/user.entity';
import {NotFoundError} from 'routing-controllers';
import {ComponentFile} from '../entities/component-file.entity';

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

	public async getComponentPageForUser(pageNr: number, pageSize: number, user: User, search?: string): Promise<Page<Component>> {
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

	public async createComponentForUser(name: string, symbol: string, description: string, user: User) {
		const component = this.create();
		component.name = name;
		component.symbol = symbol;
		component.description = description;
		component.user = Promise.resolve(user);
		component.componentFile = new ComponentFile();
		component.numInputs = 0;
		component.numOutputs = 0;
		component.labels = [];
		return this.save(component);
	}
}
