import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ENV, Env, loadEnv } from './config/env';
import { TextAnalysisWorkerModule } from './text-analysis/text-analysis-worker.module';

describe('AppModule', () => {
  it('exposes the validated environment to feature modules', async () => {
    // The provider is global, so a module that imports nothing can inject it.
    const env = loadEnv({ PORT: '4242' });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forEnv(env)]
    }).compile();

    expect(moduleRef.get<Env>(ENV)).toBe(env);
  });

  it('leaves the text analysis worker out for a tool', () => {
    const env = loadEnv({
      OPENROUTER_API_KEY: 'sk-or-test',
      OPENROUTER_PRESET: 'logigator'
    });
    expect(env.TEXT_ANALYSIS_WORKER_ENABLED).toBe(true);

    expect(AppModule.forEnv(env).imports).toContain(TextAnalysisWorkerModule);
    expect(AppModule.forEnv(env, { worker: false }).imports).not.toContain(
      TextAnalysisWorkerModule
    );
  });
});
