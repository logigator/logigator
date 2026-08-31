import { Body, Controller, Post } from '@nestjs/common';
import {
  reportErrorRequestSchema,
  type ReportErrorRequest,
  type ReportErrorResponse
} from '@logigator/contract';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { UseGuards } from '@nestjs/common';
import { SessionUserId } from '../auth/auth.guard';
import { ReportsService } from './reports.service';

/**
 * Client-side error reports. The path and field-by-field shape are fixed from
 * outside — the editor posts to `/api/report-error`.
 *
 * Unauthenticated on purpose: a crash while signed out is worth hearing about,
 * and requiring a session would silently drop it. The session is read when
 * there is one, since which account hit a bug is most of what makes a report
 * actionable.
 */
@Controller('report-error')
@UseGuards(RateLimitGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * Rate-limited by address in its own scope: an anonymous write of
   * attacker-chosen text, so the limit is all that stands between it and a log
   * nobody can read.
   */
  @Post()
  @RateLimit({ limit: 10, windowSeconds: 600, scope: 'report-error' })
  async report(
    @Body({ schema: reportErrorRequestSchema })
    body: ReportErrorRequest,
    @SessionUserId() reporterId: string | null
  ): Promise<ReportErrorResponse> {
    await this.reports.record(body, reporterId);
    return { received: true };
  }
}
