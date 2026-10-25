import { Module } from '@nestjs/common';
import { TranslationModule } from './translation.module';
import {
  systemClock,
  TRANSLATION_CLOCK,
  TranslationWorker
} from './translation.worker';

/**
 * The worker and the translator it calls. Imported by the application only
 * where `TRANSLATION_WORKER_ENABLED` is true, so without a key, or with
 * translation switched off, nothing is scheduled, claimed or sent, and no
 * translator is constructed.
 */
@Module({
  imports: [TranslationModule],
  providers: [
    TranslationWorker,
    { provide: TRANSLATION_CLOCK, useValue: systemClock }
  ]
})
export class TranslationWorkerModule {}
