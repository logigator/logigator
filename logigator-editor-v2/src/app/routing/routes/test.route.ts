import { Route, RouteKeys } from '../route.model';
import { Injectable } from '@angular/core';
import { TestService } from '../../test.service';

@Injectable({
	providedIn: 'root'
})
export class TestRoute implements Route {
	readonly route = '/test/:param2';

	constructor(private testService: TestService) {
		console.log('TestRoute created');
		console.log('TestService:', testService.test);
	}

	onActivation(params: RouteKeys<typeof this.route>): boolean {
		console.log('TestRoute.onActivation', params);

		return false;
	}

}
