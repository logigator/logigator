import { inject, Injectable, Type } from '@angular/core';
import { ProjectRoute } from './routes/project.route';
import { ShareRoute } from './routes/share.route';
import { LocalProjectRoute } from './routes/local-project.route';
import { Route } from './route.model';
import { Location } from '@angular/common';
import { parse } from 'regexparam';
import { RouteKeys } from './route-keys.model';
import { LoggingService } from '../logging/logging.service';

const ROUTES: Type<Route>[] = [ProjectRoute, ShareRoute, LocalProjectRoute];

@Injectable({
	providedIn: 'root'
})
export class RouterService {
	private readonly logging = inject(LoggingService);
	private readonly location = inject(Location);

	private _routes: {
		instance: Route;
		keys: string[];
		pattern: RegExp;
	}[] = [];

	constructor() {
		for (const route of ROUTES) {
			const instance = inject(route);
			this._routes.push({
				...parse(instance.route),
				instance
			});
		}
	}

	public async processCurrentRoute(): Promise<void> {
		if (!(await this.processPath(this.location.path()))) {
			this.logging.error(
				`No route found for path: ${this.location.path()}`,
				'RouterService'
			);
			this.location.replaceState('/');
		}
	}

	public matches(path: string): boolean {
		return [...this._routes.values()].some((route) => route.pattern.test(path));
	}

	public async navigate(path: string): Promise<boolean> {
		if (await this.processPath(path)) {
			this.location.go(path);
			return true;
		}

		return false;
	}

	private async processPath(path: string): Promise<boolean> {
		if (path === '' || path === '/') {
			return true;
		}

		for (const route of this._routes) {
			const match = route.pattern.exec(path);
			if (!match) {
				continue;
			}

			const params: RouteKeys<typeof path> = {};

			for (let i = 0; i < route.keys.length; i++) {
				params[route.keys[i]] = match[i + 1] ?? null;
			}

			// @ts-expect-error Some unfortunate type issues
			if (await route.instance.onActivation(params)) {
				this.logging.debug({ path, params }, 'RouterService');
				return true;
			}
		}

		return false;
	}
}
