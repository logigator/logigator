import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import type { ShareDetail, ShareDependenciesResponse } from '../models/share';

@Injectable({ providedIn: 'root' })
export class ShareApiService {
  private readonly path = '/api/share';
  private readonly api = inject(ApiBaseService);

  /** GET /api/share/:link — get a shared project or component by its share link. */
  get(link: string): Observable<ShareDetail> {
    return this.api.get<ShareDetail>(`${this.path}/${link}`);
  }

  /** GET /api/share/dependencies/:link — get recursive dependencies for a shared resource. */
  getDependencies(link: string): Observable<ShareDependenciesResponse> {
    return this.api.get<ShareDependenciesResponse>(
      `${this.path}/dependencies/${link}`
    );
  }
}
