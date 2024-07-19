import { TranslateLoader } from '@ngx-translate/core';
import { from, Observable } from 'rxjs';

export class CacheBustingTranslationLoader implements TranslateLoader {
	getTranslation(lang: string): Observable<object> {
		try {
			return from(import(`../../../assets/i18n/${lang}.json`));
		} catch (e) {
			lang = 'en'; // Fallback to 'en' if the language file is not found
			return from(import(`../../../assets/i18n/${lang}.json`));
		}
	}
}
