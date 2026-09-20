import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { cloneResponseSchema, type CloneResponse } from '@logigator/contract';
import type { LgDocumentKind } from '@logigator/ui';
import { ApiBaseService } from './api-base.service';

/**
 * Taking a copy of somebody else's document. The link is the grant — cloning
 * needs no more than holding it — and the copy lands in the caller's account,
 * with its own masters rather than with somebody else's.
 *
 * Reading a link is not here: the page one lands on is the community page,
 * which resolves the document through its own detail route.
 */
@Injectable({ providedIn: 'root' })
export class ShareApiService {
  private readonly api = inject(ApiBaseService);

  /**
   * POST /api/share/{kind}/{link}/clone. The kind names the table the token was
   * found in, which the server cannot work out on its own — a token is a column
   * in both of them. A link that was regenerated, and one naming a document the
   * caller may not open, are both `not_found`.
   */
  public clone(kind: LgDocumentKind, link: string): Observable<CloneResponse> {
    return this.api.post(
      `/api/share/${kind}/${link}/clone`,
      cloneResponseSchema
    );
  }
}
