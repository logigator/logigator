import { Route } from '../route.model';
import { Injectable } from '@angular/core';
import { RouteKeys } from '../route-keys.model';
import { LoggingService } from '../../logging/logging.service';

@Injectable({
	providedIn: 'root'
})
export class TestRoute implements Route {
	readonly route = '/test/:param2';

	constructor(private readonly loggingService: LoggingService) {}

	onActivation(params: RouteKeys<typeof this.route>): boolean {
		this.loggingService.log(params, 'TestRoute');
		return true;
	}
}
