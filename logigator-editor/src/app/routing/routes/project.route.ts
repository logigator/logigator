import { Route } from '../route.model';
import { inject, Injectable } from '@angular/core';
import { PersistenceService } from '../../persistence/persistence.service';
import { RouteKeys } from '../route-keys.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectRoute implements Route {
  private readonly persistenceService = inject(PersistenceService);

  readonly route = '/project/:uuid';

  async onActivation(params: RouteKeys<typeof this.route>): Promise<boolean> {
    await this.persistenceService.loadProjectAsMain(params.uuid, {
      skipUrlUpdate: true
    });
    return true;
  }
}
