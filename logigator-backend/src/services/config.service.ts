import {Service} from 'typedi';
import * as fs from 'fs';
import * as path from 'path';

@Service()
export class ConfigService {

	private _config = new Map<string, any>();

	constructor() {
		this.initialize(path.join(__dirname, '..', '..'));
	}

	public initialize(projectRootPath: string) {
		this._config.set('projectRootPath', projectRootPath);

		const configPath = path.join(this.projectRootPath, 'config');
		fs.readdirSync(configPath).forEach(configFile => {
			if (configFile.endsWith('.json.example') || !configFile.endsWith('.json')) {
				return;
			}
			const config = fs.readFileSync(path.join(configPath, configFile)).toString();
			this._config.set(path.parse(configFile).name, JSON.parse(config));
		});
	}

	public getConfig<T = any>(key: string): T {
		if (!this._config.has(key)) {
			return undefined;
		}
		return this._config.get(key) as T;
	}

	public get projectRootPath(): string {
		return this._config.get('projectRootPath');
	}

}
