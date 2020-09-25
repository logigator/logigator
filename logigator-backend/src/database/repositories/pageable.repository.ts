import {FindManyOptions, FindOneOptions, Repository} from 'typeorm';

export class PageableRepository<T> extends Repository<T> {
	protected defaultPagesize = 20;
	protected maxPagesize = 1000;

	public async getPage(page = 0, pageSize: number = this.defaultPagesize, options: FindOneOptions<T> = {}): Promise<Page<T>> {
		if (pageSize <= 0)
			pageSize = this.defaultPagesize;
		else if (pageSize > this.maxPagesize)
			pageSize = this.maxPagesize;

		const results = await super.findAndCount(Object.assign(options, {
			skip: page * pageSize,
			take: pageSize
		}) as FindManyOptions);
		return {
			page,
			total: Math.ceil(results[1] / pageSize),
			count: results[0].length,
			entries: results[0]
		} as Page<T>;
	}
}

export interface Page<T> {
	page: number;
	total: number;
	count: number;
	entries: T[];
}
