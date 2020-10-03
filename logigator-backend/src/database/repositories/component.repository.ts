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

	public async getOwnedComponentOrThrow(componentId: string, user: User, message = 'ResourceNotFound'): Promise<Component> {
		const component = await this.findOne({
			where: {
				id: componentId,
				user: user
			}
		});
		if (!component)
			throw new NotFoundError(message);
		return component;
	}

	public async clone(component: Component, user: User) {
		const cloned = this.create();
		cloned.name = component.name;
		cloned.description = component.description;
		cloned.user = Promise.resolve(user);
		cloned.forkedFrom = Promise.resolve(component);
		cloned.createdOn = component.createdOn;
		cloned.labels = component.labels;
		cloned.numInputs = component.numInputs;
		cloned.numOutputs = component.numOutputs;
		cloned.symbol = component.symbol;
		cloned.componentFile = new ComponentFile();
		if (component.componentFile) cloned.componentFile.setFileContent(await component.componentFile.getFileContent());
		return this.save(cloned);
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
		component.labels = [];
		return this.save(component);
	}

	public async deleteComponentForUser(projectId: string, user: User): Promise<Component> {
		const component = await this.getOwnedComponentOrThrow(projectId, user);
		await this.remove(component);
		return component;
	}
}
