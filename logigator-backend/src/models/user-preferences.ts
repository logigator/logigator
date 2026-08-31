import { LanguageCode } from '../i18n';

export const availableThemes = ['dark', 'light'] as const;
export const defaultTheme: Theme = 'dark';

export interface UserPreferences {
	lang: LanguageCode,
	theme: Theme;
}

export type Theme = typeof availableThemes[number];
