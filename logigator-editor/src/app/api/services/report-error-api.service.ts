import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from './api-base.service';
import type { ReportErrorRequest } from '../models/report-error';

export interface ReportErrorResponse {
  success: boolean;
}

@Injectable({ providedIn: 'root' })
export class ReportErrorApiService {
  private readonly path = '/api/report-error';
  private readonly api = inject(ApiBaseService);

  /** POST /api/report-error — submit a client-side error report. */
  report(body: ReportErrorRequest): Observable<ReportErrorResponse> {
    return this.api.post<ReportErrorResponse>(this.path, body);
  }
}
