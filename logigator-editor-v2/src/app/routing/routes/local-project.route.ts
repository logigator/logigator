import { Route } from '../route.model';
import { Injectable, inject } from '@angular/core';
import { PersistenceService } from '../../persistence/persistence.service';
import { RouteKeys } from '../route-keys.model';

@Injectable({
	providedIn: 'root'
})
export class LocalProjectRoute implements Route {
	private readonly persistenceService = inject(PersistenceService);

	readonly route = '/local/:id';

	async onActivation(params: RouteKeys<typeof this.route>): Promise<boolean> {
		await this.persistenceService.loadLocalProjectAsMain(params.id, {
			skipUrlUpdate: true
		});
		return true;
	}
}
