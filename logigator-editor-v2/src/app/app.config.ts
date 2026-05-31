import {
	ApplicationConfig,
	isDevMode,
	provideZoneChangeDetection
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		providePrimeNG({ theme: { preset: Aura } }),
		ConfirmationService,
		provideTransloco({
			config: {
				defaultLang: 'en',
				availableLangs: ['en', 'de'],
				reRenderOnLangChange: true,
				prodMode: !isDevMode()
			},
			loader: TranslationLoaderService
		}),
		provideHttpClient()
	]
};
