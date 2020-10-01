import {Service} from 'typedi';
import {EntityRepository, getCustomRepository, Repository} from 'typeorm';
import {ProjectDependency} from '../entities/project-dependency.entity';
import {Component} from '../entities/component.entity';
import {Project} from '../entities/project.entity';
import {ComponentDependencyRepository} from './component-dependency.repository';

@Service()
@EntityRepository(ProjectDependency)
export class ProjectDependencyRepository extends Repository<ProjectDependency> {

	public async getDependencies(project: Project, recursive = false): Promise<Component[]> {
		const dependencies = await this.find({
			where: {
				dependent: project
			}
		});

		if (!recursive)
			return dependencies.map(x => x.dependency);

		let deps = new Map<string, Component>();
		for (const dep of dependencies) {
			if (deps.has(dep.dependency.id))
				continue;
			deps.set(dep.dependency.id, dep.dependency);
			deps = await getCustomRepository(ComponentDependencyRepository).getRecursiveDependencies(dep.dependency, deps);
		}
		return Array.from(deps.values());
	}

	public async getDependents(component: Component): Promise<Project[]> {
		const dependents = await this.find({
			where: {
				dependency: component
			}
		});
		return dependents.map(x => x.dependent);
	}
}
