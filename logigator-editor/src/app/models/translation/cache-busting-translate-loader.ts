import { TranslateLoader } from '@ngx-translate/core';
import { from, Observable } from 'rxjs';

export class CacheBustingTranslationLoader implements TranslateLoader {
	getTranslation(lang: string): Observable<object> {
		return from(import(`../../../assets/i18n/${lang}.json`));
	}
}
