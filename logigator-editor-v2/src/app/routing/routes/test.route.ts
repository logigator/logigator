import { Route } from '../route.model';
import { Injectable, inject } from '@angular/core';
import { RouteKeys } from '../route-keys.model';
import { LoggingService } from '../../logging/logging.service';

@Injectable({
	providedIn: 'root'
})
export class TestRoute implements Route {
	private readonly loggingService = inject(LoggingService);

	readonly route = '/test/:param2';

	onActivation(params: RouteKeys<typeof this.route>): boolean {
		this.loggingService.log(params, 'TestRoute');
		return true;
	}
}
