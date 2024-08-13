import {
	ApplicationConfig,
	isDevMode,
	provideZoneChangeDetection
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideTransloco({
			config: {
				defaultLang: 'en',
				availableLangs: ['en', 'de'],
				reRenderOnLangChange: true,
				prodMode: !isDevMode()
			},
			loader: TranslationLoaderService
		})
	]
};
