import {
	ApplicationConfig,
	isDevMode,
	provideZonelessChangeDetection
} from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { TranslationLoaderService } from './translation/translation-loader.service';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { provideHttpClient } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZonelessChangeDetection(),
		providePrimeNG({ theme: { preset: Aura } }),
		ConfirmationService,
		MessageService,
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
