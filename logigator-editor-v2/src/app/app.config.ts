import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { RouterService } from './routing/router.service';

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		{
			provide: RouterService
		}
	]
};
