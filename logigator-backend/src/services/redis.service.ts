import {Service} from 'typedi';
import {ConfigService} from './config.service';
import {createClient, RedisClientType} from 'redis';

@Service()
export class RedisService {

	private _redisClient: RedisClientType;

	constructor(private configService: ConfigService) {
	}

	public async init(): Promise<void> {
		this._redisClient = createClient({
			legacyMode: true,
			...this.configService.getConfig('redis')
		});
		await this._redisClient.connect();
	}

	public get redisClient(): RedisClientType {
		return this._redisClient;
	}

	public has(key: string): Promise<boolean> {
		return this.redisClient.v4.exists(key);
	}

	public delete(key: string): Promise<void> {
		return this.redisClient.v4.del(key);
	}

	public ttl(key: string): Promise<number> {
		return this.redisClient.v4.ttl(key);
	}

	public setString(key: string, value: string, expire: number): Promise<void> {
		return this.redisClient.v4.set(key, value, {EX: expire});
	}

	public getString(key: string): Promise<string> {
		return this.redisClient.v4.get(key);
	}

	public async setObject(key: string, value: { [key: string]: string | number }, expire: number): Promise<void> {
		await this.redisClient.v4.HSET(key, value);
		this.redisClient.v4.expire(key, expire);
	}

	public getObject(key: string): Promise<any> {
		return this.redisClient.v4.hGetAll(key);
	}

}
