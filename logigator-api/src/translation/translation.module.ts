import { Module } from '@nestjs/common';
import { ENV, type Env } from '../config/env';
import { OpenRouterClient } from './openrouter/openrouter.client';
import { TRANSLATOR } from './translator';

/**
 * The translator behind {@link TRANSLATOR}, through OpenRouter. It belongs
 * only in an application whose environment carries a key — where
 * `TRANSLATION_WORKER_ENABLED` is true, or where a harness overrides the token
 * with a fake — since a provider that cannot reach anybody is better refused
 * at boot than discovered at the first claim.
 */
@Module({
  providers: [
    {
      provide: TRANSLATOR,
      inject: [ENV],
      useFactory: (env: Env) => {
        if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_PRESET) {
          throw new Error(
            'The translator needs OPENROUTER_API_KEY and OPENROUTER_PRESET.'
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
  exports: [TRANSLATOR]
})
export class TranslationModule {}
