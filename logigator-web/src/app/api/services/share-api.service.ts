import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  cloneResponseSchema,
  shareResponseSchema,
  type CloneResponse,
  type ShareResponse
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

/**
 * Share links. A link is a capability — it needs no session and ignores whether
 * the document is public — so reading one is what puts a handed-out URL on a
 * page of its own, and cloning is what puts the document in the caller's
 * account.
 */
@Injectable({ providedIn: 'root' })
export class ShareApiService {
  private readonly api = inject(ApiBaseService);

  /**
   * GET /api/share/:link. The document behind a token, which the landing page
   * renders: a link that was regenerated answers `not_found`, and one naming
   * nothing at all never reaches here — a malformed token is a `404` from the
   * API's own uuid pipe.
   */
  public read(link: string): Observable<ShareResponse> {
    return this.api.get(`/api/share/${link}`, shareResponseSchema);
  }

  /**
   * POST /api/share/:link/clone. Copies the document and the library it needs
   * into the caller's account, so the copy opens with its own masters rather
   * than with somebody else's.
   */
  public clone(link: string): Observable<CloneResponse> {
    return this.api.post(`/api/share/${link}/clone`, cloneResponseSchema);
  }
}
