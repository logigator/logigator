import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { metaResponseSchema, type MetaResponse } from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class MetaApiService {
  private readonly api = inject(ApiBaseService);

  /** GET /api/meta — what the deployment tells clients about itself. */
  public get(): Observable<MetaResponse> {
    return this.api.get('/api/meta', metaResponseSchema);
  }
}
