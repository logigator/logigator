import {Service} from 'typedi';
import * as fs from 'fs';
import path from 'path';
import {ConfigService} from './config.service';

@Service()
export class TranslationService {

	private _translations = new Map<string, any>();

	constructor(private configService: ConfigService) {
		this.readTranslations();
	}

	private readTranslations() {
		const i18nPath = path.join(this.configService.projectRootPath, 'resources', 'private', 'i18n');

		fs.readdirSync(i18nPath).forEach(translation => {
			if (!translation.endsWith('.json')) {
				return;
			}
			const config = fs.readFileSync(path.join(i18nPath, translation)).toString();
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

	public dateFormatTime(date: Date, lang: string) {
		switch (lang) {
			case 'en':
				return date.toLocaleTimeString('en', {
					hour: '2-digit',
					minute:'2-digit'
				});
			case 'de':
				return date.toLocaleTimeString('de', {
					hour12: false,
					hour: '2-digit',
					minute:'2-digit'
				});
		}
	}

	public dateFormatDate(date: Date, lang: string) {
		switch (lang) {
			case 'en':
				return date.toLocaleDateString('en');
			case 'de':
				return date.toLocaleDateString('de', {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				});
		}
	}

	public dateFormatDateTime(date: Date, lang: string) {
		switch (lang) {
			case 'en':
				return date.toLocaleString('en', {
					hour: '2-digit',
					minute:'2-digit',
					year: 'numeric',
					month: 'numeric',
					day: 'numeric'
				});
			case 'de':
				return date.toLocaleString('de', {
					hour12: false,
					hour: '2-digit',
					minute:'2-digit',
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				});
		}
	}

	public get availableLanguages(): string[] {
		return [...this._translations.keys()];
	}

}
