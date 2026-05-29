import { Route } from '../route.model';
import { Injectable, inject } from '@angular/core';
import { PersistenceService } from '../../persistence/persistence.service';
import { RouteKeys } from '../route-keys.model';

@Injectable({
	providedIn: 'root'
})
export class ShareRoute implements Route {
	private readonly persistenceService = inject(PersistenceService);

	readonly route = '/share/:linkId';

	async onActivation(params: RouteKeys<typeof this.route>): Promise<boolean> {
		await this.persistenceService.loadShareAsMain(params.linkId);
		return true;
	}
}
