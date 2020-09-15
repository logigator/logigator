import {Service} from "typedi";
import * as fs from 'fs';
import * as path from 'path';

@Service()
export class ConfigService {

	private readonly CONFIG_PATH = path.join(__dirname, '..', '..', 'config');

	private _config = new Map<string, any>();

	constructor() {
		this.readConfigs();
	}

	private readConfigs() {
		fs.readdirSync(this.CONFIG_PATH).forEach(configFile => {
			if (configFile.endsWith('.json.example') || !configFile.endsWith('.json')) {
				return;
			}
			const config = fs.readFileSync(path.join(this.CONFIG_PATH, configFile)).toString();
			this._config.set(path.parse(configFile).name, JSON.parse(config));
		});
	}

	public getConfig<T = any>(key: string): T {
		if (!this._config.has(key)) {
			return undefined;
		}
		return this._config.get(key) as T;
	}

}
