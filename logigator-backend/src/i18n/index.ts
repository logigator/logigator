import { en } from './en';
import { es } from './es';
import { de } from './de';
import { fr } from './fr';

export const availableLanguages = ['en', 'de', 'es', 'fr'] as const;
export const defaultLanguage: LanguageCode = 'en';

export const translations: Record<LanguageCode, ILanguage> = {
	en,
	de,
	es,
	fr
};

export type ILanguage = typeof en;
export type LanguageCode = typeof availableLanguages[number];
