import {URL} from 'url';
import { availableLanguages, LanguageCode } from '../i18n';


export function getPathnameWithoutLang(url: string): string {
	const parsed = new URL(url);

	const langMatches = parsed.pathname.match(/^\/(\w\w)/);
	if (langMatches && availableLanguages.includes(langMatches[1] as LanguageCode) && (parsed.pathname.length === 3 || parsed.pathname.charAt(3) === '/')) {
		let rewrittenUrl = parsed.pathname.substring(3);
		if (!rewrittenUrl.startsWith('/')) {
			rewrittenUrl = '/' + rewrittenUrl;
		}
		return rewrittenUrl;
	}
	return parsed.pathname;
}
