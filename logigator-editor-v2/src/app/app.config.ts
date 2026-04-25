import {
	ApplicationConfig,
	isDevMode,
	provideZoneChangeDetection
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		providePrimeNG({ theme: { preset: Aura } }),
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
