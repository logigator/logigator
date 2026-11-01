import { Module } from '@nestjs/common';
import { TURNSTILE_FETCH, TurnstileService } from './turnstile.service';

@Module({
  providers: [
    TurnstileService,
    {
      provide: TURNSTILE_FETCH,
      useValue: ((input, init) =>
        fetch(input, init)) satisfies typeof globalThis.fetch
    }
  ],
  exports: [TurnstileService]
})
export class ChallengeModule {}
