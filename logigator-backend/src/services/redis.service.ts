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
		return this.redisClient;
	}

}
