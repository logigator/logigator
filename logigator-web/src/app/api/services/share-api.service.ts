import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { cloneResponseSchema, type CloneResponse } from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

/**
 * Share links. The site only ever clones through one — reading a document is
 * the editor's job, and opening a share needs no request from here at all,
 * `<editor>/share/<link>` being a plain link.
 */
@Injectable({ providedIn: 'root' })
export class ShareApiService {
  private readonly api = inject(ApiBaseService);

  /**
   * POST /api/share/:link/clone. Copies the document and the library it needs
   * into the caller's account, so the copy opens with its own masters rather
   * than with somebody else's.
   */
  public clone(link: string): Observable<CloneResponse> {
    return this.api.post(`/api/share/${link}/clone`, cloneResponseSchema);
  }
}
