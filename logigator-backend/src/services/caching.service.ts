import {Service} from 'typedi';
import {RedisService} from './redis.service';

@Service()
export class CachingService {

	private readonly PREFIX = 'cache:';

	constructor(private redis: RedisService) {
	}

	public has(key: string): Promise<boolean> {
		return this.redis.has(this.PREFIX + key);
	}

	public get(key: string): Promise<string> {
		return this.redis.getString(this.PREFIX + key);
	}

	public set(key: string, value: string, expire: number): Promise<void> {
		return this.redis.setString(this.PREFIX + key, value, expire);
	}

	public delete(key: string): Promise<void> {
		return this.redis.delete(this.PREFIX + key);
	}

	public async ttl(key: string): Promise<number> {
		return this.redis.ttl(this.PREFIX + key);
	}

	public async clear(): Promise<void> {
		const keys = await this.redis.redisClient.keys(this.PREFIX + '*');
		for (const key of keys) {
			await this.redis.delete(key);
		}
	}
}
