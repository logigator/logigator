import { Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { LoggingService } from '../logging/logging.service';

@Injectable({
	providedIn: 'root'
})
export class TranslationLoaderService implements TranslocoLoader {
	constructor(private readonly loggingService: LoggingService) {}

	async getTranslation(lang: string): Promise<Translation> {
		try {
			const module = await import(`../../i18n/${lang}.ts`);
			return module.default;
		} catch {
			this.loggingService.error(
				`Language file for '${lang}' not found. Fallback to 'en'`,
				'TranslationLoaderService'
			);

			const module = await import('../../i18n/en');
			return module.default;
		}
	}
}
