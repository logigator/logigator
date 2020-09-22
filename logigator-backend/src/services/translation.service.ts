import {Service} from 'typedi';
import * as fs from 'fs';
import path from 'path';

@Service()
export class TranslationService {

	private readonly I18N_PATH = path.join(__dirname, '..', '..', 'resources', 'private', 'i18n');

	private _translations = new Map<string, any>();

	constructor() {
		this.readTranslations();
	}

	private readTranslations() {
		fs.readdirSync(this.I18N_PATH).forEach(translation => {
			if (!translation.endsWith('.json')) {
				return;
			}
			const config = fs.readFileSync(path.join(this.I18N_PATH, translation)).toString();
			this._translations.set(path.parse(translation).name, JSON.parse(config));
		});
	}

	public getTranslation(key: string, lang: string): string {
		if (!this._translations.has(lang)) {
			return key;
		}
		const translationPath = key.split('.');
		let translationMap = this._translations.get(lang);
		for (let i = 0; i < translationPath.length; i++) {
			if (translationMap[translationPath[i]]) {
				translationMap = translationMap[translationPath[i]];
			} else {
				return key;
			}
		}
		if (typeof translationMap === 'string') {
			return translationMap;
		}
		return key;
	}

	public getTranslations(lang: string): any {
		return this._translations.get(lang);
	}

	public get availableLanguages(): string[] {
		return [...this._translations.keys()];
	}

}
