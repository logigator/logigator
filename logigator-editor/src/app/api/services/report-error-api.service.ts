import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  reportErrorResponseSchema,
  type ReportErrorRequest,
  type ReportErrorResponse
} from '@logigator/contract';
import { ApiBaseService } from './api-base.service';

@Injectable({ providedIn: 'root' })
export class ReportErrorApiService {
  private readonly path = '/api/report-error';
  private readonly api = inject(ApiBaseService);

  /** POST /api/report-error — submit a client-side error report. */
  report(body: ReportErrorRequest): Observable<ReportErrorResponse> {
    return this.api.post(this.path, reportErrorResponseSchema, body);
  }
}
