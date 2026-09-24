import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  cloneResponseSchema,
  shareResponseSchema,
  type CloneResponse,
  type ShareResponse
} from '@logigator/contract';
import type { LgDocumentKind } from '@logigator/ui';
import { ApiBaseService } from './api-base.service';

/** Documents reached by their share link: `/api/share`. */
@Injectable({ providedIn: 'root' })
export class ShareApiService {
  private readonly path = '/api/share';
  private readonly api = inject(ApiBaseService);

  /**
   * GET /api/share/:kind/:link — the shared project or component. Needs no
   * session: the link is the capability, and the document embeds every custom
   * it uses. The kind is part of the address because the same token column
   * exists in two tables, so the link alone does not say which row to read.
   */
  read(kind: LgDocumentKind, link: string): Observable<ShareResponse> {
    return this.api.get(`${this.path}/${kind}/${link}`, shareResponseSchema);
  }

  /**
   * POST /api/share/:kind/:link/clone — copy the document, and the library it
   * needs, into the caller's account. A POST because it creates rows: a link
   * that cloned on being fetched is one a link preview would fire.
   */
  clone(kind: LgDocumentKind, link: string): Observable<CloneResponse> {
    return this.api.post(
      `${this.path}/${kind}/${link}/clone`,
      cloneResponseSchema
    );
  }
}
