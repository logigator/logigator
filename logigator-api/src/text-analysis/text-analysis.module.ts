import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { TEXT_ANALYZER } from './text-analyzer';

/**
 * The analyzer behind {@link TEXT_ANALYZER}, through OpenRouter. It belongs
 * only in an application whose environment carries a key — where
 * `TEXT_ANALYSIS_WORKER_ENABLED` is true, or where a harness overrides the
 * token with a fake — since a provider that cannot reach anybody is better
 * refused at boot than discovered at the first claim.
 */
@Module({
  providers: [
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
  ],
  exports: [TEXT_ANALYZER]
})
export class TextAnalysisModule {}
