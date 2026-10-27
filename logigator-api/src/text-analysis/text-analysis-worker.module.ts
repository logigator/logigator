import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { ModerationModule } from '../moderation/moderation.module';
import { OpenRouterClient } from './openrouter/openrouter.client';
import {
  ANALYSIS_CLOCK,
  systemClock,
  TextAnalysisWorker
} from './text-analysis.worker';
import { TEXT_ANALYZER } from './text-analyzer';

/**
 * The worker and the analyzer it calls. Imported by the application only
 * where `TEXT_ANALYSIS_WORKER_ENABLED` is true, so without a key, or with
 * text analysis switched off, nothing is scheduled, claimed or sent, and no
 * analyzer is constructed. Moderation is where the worker hands the verdicts
 * its calls return.
 *
 * The analyzer behind {@link TEXT_ANALYZER} goes through OpenRouter, unless a
 * harness overrides the token with a fake. A key or preset that is missing is
 * refused at boot rather than discovered at the first claim.
 */
@Module({
  imports: [ModerationModule],
  providers: [
    TextAnalysisWorker,
    { provide: ANALYSIS_CLOCK, useValue: systemClock },
    {
      provide: TEXT_ANALYZER,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_PRESET) {
          throw new Error(
            'The text analyzer needs OPENROUTER_API_KEY and OPENROUTER_PRESET.'
          );
        }
        return new OpenRouterClient({
          apiKey: env.OPENROUTER_API_KEY,
          preset: env.OPENROUTER_PRESET,
          publicUrl: env.PUBLIC_URL
        });
      }
    }
  ]
})
export class TextAnalysisWorkerModule {}
