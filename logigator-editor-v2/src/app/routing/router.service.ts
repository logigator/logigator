import { inject, Injectable, Type } from '@angular/core';
import { TestRoute } from './routes/test.route';
import { Route } from './route.model';
import { Location } from '@angular/common';
import { parse } from 'regexparam';
import { RouteKeys } from './route-keys.model';
import { LoggingService } from '../logging/logging.service';

const ROUTES: Type<Route>[] = [TestRoute];

@Injectable({
	providedIn: 'root'
})
export class RouterService {
	private routes: {
		instance: Route;
		keys: string[];
		pattern: RegExp;
	}[] = [];

	constructor(private readonly logging: LoggingService, private readonly location: Location) {
		for (const route of ROUTES) {
			const instance = inject(route);
			this.routes.push({
				...parse(instance.route),
				instance
			});
		}
	}

	public processCurrentRoute() {
		if (!this.processPath(this.location.path())) {
			this.logging.error(`No route found for path: ${this.location.path()}`, 'RouterService');
			this.location.replaceState('/');
		}
	}

	public navigate(path: string): boolean {
		if (this.processPath(path)) {
			this.location.go(path);
			return true;
		}

		return false;
	}

	private processPath(path: string): boolean {
		if (path === '' || path === '/') {
			return true;
		}

		for (const route of this.routes) {
			const match = route.pattern.exec(path);
			if (!match) {
				continue;
			}

			const params: RouteKeys<typeof path> = {};

			for (let i = 0; i < route.keys.length; i++) {
				params[route.keys[i]] = match[i + 1] ?? null;
			}

			// @ts-expect-error Some unfortunate type issues
			if (route.instance.onActivation(params)) {
				this.logging.debug({ path, params }, 'RouterService');
				return true;
			}
		}

		return false;
	}
}
