import { RouteKeys } from './route-keys.model';

export interface Route {
	readonly route: string;
	onActivation: (params: RouteKeys<never>) => boolean;
}
