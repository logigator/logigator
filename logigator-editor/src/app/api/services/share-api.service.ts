import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  cloneResponseSchema,
  shareResponseSchema,
  type CloneResponse,
  type ShareResponse
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

/** Documents reached by their share link: `/api/share`. */
@Injectable({ providedIn: 'root' })
export class ShareApiService {
  private readonly path = '/api/share';
  private readonly api = inject(ApiBaseService);

  /**
   * GET /api/share/:link — the shared project or component. Needs no session:
   * the link is the capability, and the document embeds every custom it uses.
   */
  read(link: string): Observable<ShareResponse> {
    return this.api.get(`${this.path}/${link}`, shareResponseSchema);
  }

  /**
   * POST /api/share/:link/clone — copy the document, and the library it needs,
   * into the caller's account. A POST because it creates rows: a link that
   * cloned on being fetched is one a link preview would fire.
   */
  clone(link: string): Observable<CloneResponse> {
    return this.api.post(`${this.path}/${link}/clone`, cloneResponseSchema);
  }
}
