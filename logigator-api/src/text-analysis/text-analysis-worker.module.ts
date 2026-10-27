import { Module } from '@nestjs/common';
import { ModerationModule } from '../moderation/moderation.module';
import { TextAnalysisModule } from './text-analysis.module';
import {
  ANALYSIS_CLOCK,
  systemClock,
  TextAnalysisWorker
} from './text-analysis.worker';

/**
 * The worker and the analyzer it calls. Imported by the application only
 * where `TEXT_ANALYSIS_WORKER_ENABLED` is true, so without a key, or with
 * text analysis switched off, nothing is scheduled, claimed or sent, and no
 * analyzer is constructed. Moderation is where the worker hands the verdicts
 * its calls return.
 */
@Module({
  imports: [TextAnalysisModule, ModerationModule],
  providers: [
    TextAnalysisWorker,
    { provide: ANALYSIS_CLOCK, useValue: systemClock }
  ]
})
export class TextAnalysisWorkerModule {}
