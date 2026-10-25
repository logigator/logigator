import { Route } from '../route.model';
import { inject, Injectable } from '@angular/core';
import { PersistenceService } from '../../persistence/persistence.service';
import { RouteKeys } from '../route-keys.model';

/**
 * `/component/:uuid` — opens a server component as the main project for
 * standalone editing. Opening one from *within* a project goes through the tab
 * flow instead (`CustomComponentService`).
 */
@Injectable({
  providedIn: 'root'
})
export class ComponentRoute implements Route {
  private readonly persistenceService = inject(PersistenceService);

  readonly route = '/component/:uuid';

  async onActivation(params: RouteKeys<typeof this.route>): Promise<boolean> {
    await this.persistenceService.loadComponentAsMain(params.uuid, {
      skipUrlUpdate: true
    });
    return true;
  }
}
