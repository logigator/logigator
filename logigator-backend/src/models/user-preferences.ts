import { LanguageCode } from '../i18n';

export interface UserPreferences {
	lang: LanguageCode,
	theme: 'dark' | 'light';
}
