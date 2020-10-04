import {Service} from 'typedi';
import {ConfigService} from './config.service';
import {createClient, RedisClient} from 'redis';

@Service()
export class RedisService {

	private _redisClient: RedisClient;

	constructor(private configService: ConfigService) {}

	public get redisClient(): RedisClient {
		if (this._redisClient)
			return this._redisClient;

		this._redisClient = createClient(this.configService.getConfig('redis'));
		return this._redisClient;
	}

	public has(key: string): Promise<boolean> {
		return new Promise<boolean>((resolve, reject) => {
			this.redisClient.exists(key, (err, reply) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(!!reply);
			});
		});
	}

	public ttl(key: string): Promise<number> {
		return new Promise<number>((resolve, reject) => {
			this.redisClient.ttl(key, (err, reply) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(reply);
			});
		});
	}

	public setString(key: string, value: string, expire: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.redisClient.setex(key, expire, value, (err) => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	}

	public getString(key: string): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			this.redisClient.get(key, (err, reply) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(reply);
			});
		});
	}

	public setObject(key: string, value: any, expire: number): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this.redisClient.hmset(key, value, (err) => {
				if (err) {
					reject(err);
					return;
				}
				this.redisClient.expire(key, expire);
				resolve();
			});
		});
	}

	public getObject(key: string): Promise<any> {
		return new Promise<any>((resolve, reject) => {
			this.redisClient.hgetall(key, (err, reply) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(reply);
			});
		});
	}

}
