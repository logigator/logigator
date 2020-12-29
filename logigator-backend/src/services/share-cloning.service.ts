import {Service} from 'typedi';
import {User} from '../database/entities/user.entity';
import {Project} from '../database/entities/project.entity';
import {NotFoundError} from 'routing-controllers';
import {InjectRepository} from 'typeorm-typedi-extensions';
import {ProjectRepository} from '../database/repositories/project.repository';
import {ComponentRepository} from '../database/repositories/component.repository';
import {UserRepository} from '../database/repositories/user.repository';
import {ProjectDependencyRepository} from '../database/repositories/project-dependency.repository';
import {Transaction, TransactionRepository} from 'typeorm';
import {Component} from '../database/entities/component.entity';
import {ComponentDependencyRepository} from '../database/repositories/component-dependency.repository';
import {ProjectFile} from '../database/entities/project-file.entity';

@Service()
export class ShareCloningService {

	constructor(
		@InjectRepository() private projectRepo: ProjectRepository,
		@InjectRepository() private componentRepo: ComponentRepository,
		@InjectRepository() private userRepo: UserRepository,
		@InjectRepository() private projectDepRepo: ProjectDependencyRepository,
		@InjectRepository() private compDepRepo: ComponentDependencyRepository
	) {}

	public async cloneProject(link: string, currentUser: User): Promise<Project> {
		const project = await this.projectRepo.findOne({
			where: {
				link
			}
		});
		if (!project)
			throw new NotFoundError('ResourceNotFound');

		const dependencies = await this.projectDepRepo.getDependencies(project, true);
		return this.cloneProjectTransaction(project, dependencies, currentUser);
	}

	public async cloneComponent(link: string, currentUser: User): Promise<Component[]> {
		const component = await this.componentRepo.findOne({
			where: {
				link
			}
		});
		if (!component)
			throw new NotFoundError('ResourceNotFound');

		const dependencies = await this.compDepRepo.getDependencies(component, true);
		const clonedProjects = await this.cloneComponentTransaction([component, ...dependencies], currentUser);
		return Array.from(clonedProjects.values());
	}

	@Transaction()
	private async cloneProjectTransaction(
		project: Project,
		dependencies: Component[],
		user: User,
		@TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
		@TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
		@TransactionRepository(ComponentDependencyRepository) compDepRepo?: ComponentDependencyRepository,
		@TransactionRepository(ProjectDependencyRepository) projDepRepo?: ProjectDependencyRepository
	) {
		const map = new Map<string, Component>();
		for (const dep of dependencies) {
			map.set(dep.id, await compRepo.clone(dep, user));
		}

		for (const comp of map) {
			const deps = (await compDepRepo.find({
				where: {
					dependent: comp[0]
				}
			})).map(x => {
				const dep = compDepRepo.create();
				dep.dependency = map.get(x.dependency.id);
				dep.model_id = x.model_id;
				return dep;
			});
			comp[1].dependencies = Promise.resolve(deps);
			await compRepo.save(comp[1]);
		}

		const cloned = projRepo.create();
		cloned.name = project.name;
		cloned.description = project.description;
		cloned.user = Promise.resolve(user);
		cloned.forkedFrom = Promise.resolve(project);
		cloned.createdOn = project.createdOn;
		cloned.elementsFile = new ProjectFile();
		if (project.elementsFile) cloned.elementsFile.setFileContent(await project.elementsFile.getFileContent());
		const deps = (await projDepRepo.find({
			where: {
				dependent: project
			}
		})).map(x => {
			const dep = projDepRepo.create();
			dep.dependency = map.get(x.dependency.id);
			dep.model_id = x.model_id;
			return dep;
		});
		cloned.dependencies = Promise.resolve(deps);
		return await projRepo.save(cloned);
	}

	@Transaction()
	private async cloneComponentTransaction(
		dependencies: Component[],
		user: User,
		@TransactionRepository(ComponentRepository) compRepo?: ComponentRepository,
		@TransactionRepository(ProjectRepository) projRepo?: ProjectRepository,
		@TransactionRepository(ComponentDependencyRepository) compDepRepo?: ComponentDependencyRepository
	) {
		const map = new Map<string, Component>();
		for (const dep of dependencies) {
			map.set(dep.id, await compRepo.clone(dep, user));
		}

		for (const comp of map) {
			const deps = (await compDepRepo.find({
				where: {
					dependent: comp[0]
				}
			})).map(x => {
				const dep = compDepRepo.create();
				dep.dependency = map.get(x.dependency.id);
				dep.model_id = x.model_id;
				return dep;
			});
			comp[1].dependencies = Promise.resolve(deps);
			await compRepo.save(comp[1]);
		}

		return map;
	}

}
