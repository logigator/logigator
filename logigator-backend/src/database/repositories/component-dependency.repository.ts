import {Service} from 'typedi';
import {EntityRepository, Repository} from 'typeorm';
import {ComponentDependency} from '../entities/component-dependency.entity';
import {Component} from '../entities/component.entity';

@Service()
@EntityRepository(ComponentDependency)
export class ComponentDependencyRepository extends Repository<ComponentDependency> {

	public async getDependencies(component: Component, recursive = false): Promise<Component[]> {
		if (recursive)
			return Array.from((await this.getRecursiveDependencies(component)).values());

		const dependencies = await this.find({
			where: {
				dependent: component
			}
		});
		return dependencies.map(x => x.dependency);
	}

	public async getRecursiveDependencies(component: Component, deps = new Map<string, Component>()): Promise<Map<string, Component>> {
		const dependencies = await this.find({
			where: {
				dependent: component
			}
		});

		for (const dependency of dependencies) {
			if (deps.has(dependency.dependency.id))
				continue;
			deps.set(dependency.dependency.id, dependency.dependency);
			deps = await this.getRecursiveDependencies(dependency.dependency, deps);
		}

		return deps;
	}

	public async getDependents(component: Component): Promise<Component[]> {
		const dependents = await this.find({
			where: {
				dependency: component
			}
		});
		return dependents.map(x => x.dependent);
	}
}
