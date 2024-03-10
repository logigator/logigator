import { Service } from 'typedi';
import { defaultLanguage, ILanguage, LanguageCode, translations } from '../i18n';

@Service()
export class TranslationService {

	public getTranslation(key: string, lang: LanguageCode): string {
		if (!translations[lang]) {
			lang = defaultLanguage;
		}
		let translation: ILanguage = translations[lang];

		const translationPath = key.split('.');
		for (let i = 0; i < translationPath.length; i++) {
			if (translation[translationPath[i]]) {
				translation = translation[translationPath[i]];
			} else {
				return key;
			}
		}

		if (typeof translation === 'string') {
			return translation;
		}

		return key;
	}

	public getTranslations(lang: LanguageCode): ILanguage {
		return translations[lang];
	}

	public dateFormatTime(date: Date | string, lang: string): string {
		if (!(date instanceof Date))
			date = new Date(date);
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
			default: return date.toLocaleTimeString(lang, {
				hour: '2-digit',
				minute:'2-digit'
			});
		}
	}

	public dateFormatDate(date: Date | string, lang: string): string {
		if (!(date instanceof Date))
			date = new Date(date);
		switch (lang) {
			case 'de':
				return date.toLocaleDateString('de', {
					year: 'numeric',
					month: 'short',
					day: 'numeric'
				});
			default: return date.toLocaleDateString(lang);
		}
	}

	public dateFormatDateTime(date: Date | string, lang: string): string {
		if (!(date instanceof Date))
			date = new Date(date);
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
			default:
				return date.toLocaleString(lang);
		}
	}

}
