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

	public async getComponentWithStargazersCountByLink(link: string): Promise<Component> {
		return await this.createQueryBuilder('component')
			.loadRelationCountAndMap('component.stargazersCount', 'component.stargazers')
			.leftJoinAndSelect('component.previewDark', 'previewDark')
			.leftJoinAndSelect('component.previewLight', 'previewLight')
			.where('component.link = :link', {link})
			.getOne();
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
		cloned.elementsFile = new ComponentFile();
		if (component.elementsFile) cloned.elementsFile.setFileContent(await component.elementsFile.getFileContent());
		return this.save(cloned);
	}

	public getComponentPageForUser(pageNr: number, pageSize: number, user: User, search?: string, onlyShowPublic = false): Promise<Page<Component>> {
		return this.getPage(pageNr, pageSize, {
			where: {
				user: user,
				...(search && {name: Like('%' + search + '%')}),
				...(onlyShowPublic && {public: true})
			},
			order: {
				lastEdited: 'DESC'
			}
		});
	}

	public async getSharedComponentsPage(pageNr: number, pageSize: number, search?: string, orderOnlyByTime?: boolean): Promise<Page<Component>> {
		if (orderOnlyByTime) {
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

		const query = this.createQueryBuilder('component')
			.leftJoin('component.stargazers', 'stargazers')
			.leftJoinAndSelect('component.previewDark', 'previewDark')
			.leftJoinAndSelect('component.previewLight', 'previewLight')
			.addSelect('COUNT(stargazers.id)', 'stargazersCount')
			.where('component.public = :isPublic', {isPublic: true});

		if (search)
			query.andWhere('component.name like :search', {search: `%${search}%`});

		const results = await query.groupBy('component.id')
			.orderBy('stargazersCount', 'DESC')
			.addOrderBy('component.lastEdited', 'DESC')
			.skip(pageNr * pageSize)
			.take(pageSize)
			.getManyAndCount();

		return {
			page: pageNr,
			total: Math.ceil(results[1] / pageSize),
			count: results[0].length,
			entries: results[0]
		} as Page<Component>;
	}

	public createComponentForUser(name: string, symbol: string, description: string, sharePublicly: boolean, user: User) {
		const component = this.create();
		component.name = name;
		component.symbol = symbol;
		component.description = description;
		component.public = sharePublicly;
		component.user = Promise.resolve(user);
		component.elementsFile = new ComponentFile();
		component.labels = [];
		return this.save(component);
	}

	public async deleteComponentForUser(projectId: string, user: User): Promise<Component> {
		const component = await this.getOwnedComponentOrThrow(projectId, user);
		await this.remove(component);
		return component;
	}

	public async hasUserStaredComponent(component: Component, user: User): Promise<boolean> {
		const count = await this.createQueryBuilder('component')
			.leftJoin('component.stargazers', 'user')
			.where('component.id = :compId', {compId: component.id})
			.andWhere('user.id = :userId', {userId: user.id})
			.limit(1)
			.getCount();
		return Boolean(count);
	}

	public async getStargazersCount(component: Component): Promise<number> {
		return (await this.createQueryBuilder('component')
			.select(['COUNT(component.id) AS count'])
			.innerJoin('component.stargazers', 'user')
			.where('component.id = :id', {id: component.id})
			.getRawOne()).count;
	}

	public async getComponentsStaredByUser(page: number, pageSize: number, user: User): Promise<Page<Component>> {
		const results = await this.createQueryBuilder('component')
			.leftJoin('component.stargazers', 'user')
			.where('component.public = :isPublic', {isPublic: true})
			.andWhere('user.id = :userId', {userId: user.id})
			.skip(page * pageSize)
			.take(pageSize)
			.getManyAndCount();

		return {
			page,
			total: Math.ceil(results[1] / pageSize),
			count: results[0].length,
			entries: results[0]
		} as Page<Component>;
	}
}
