import { inject, Injectable, Type } from '@angular/core';
import { TestRoute } from './routes/test.route';
import { Route } from './route.model';
import { Location } from '@angular/common';
import { parse } from 'regexparam';

const ROUTES: Type<Route>[] = [TestRoute];

@Injectable({
	providedIn: 'root'
})
export class RouterService {
	private routes: {
		instance: Route,
		keys: string[];
		pattern: RegExp;
	}[] = [];

	constructor(private location: Location) {
		console.log('RouterService created');

		for (const route of ROUTES) {
			const instance = inject(route);
			this.routes.push({
				...parse(instance.route),
				instance
			});
		}

		this.processPath(this.location.path());
	}

	private processPath(path: string) {
		for (const route of this.routes) {
			const match = route.pattern.exec(path);
			if (!match) {
				continue;
			}

			const params: Record<string, string | null> = {};

			for (let i = 0; i < route.keys.length; i++) {
				params[route.keys[i]] = match[i + 1] || null;
			}

			console.log('Route: %s, Params: %o', route, params);
			// @ts-expect-error This should be reworked to not use any
			if (route.instance.onActivation(params)) {
				return;
			}
		}

		this.location.go('/');
	}
}
