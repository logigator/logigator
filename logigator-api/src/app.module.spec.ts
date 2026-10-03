import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { ENV, Env, loadEnv } from './config/env';

describe('AppModule', () => {
  it('exposes the validated environment to feature modules', async () => {
    // The provider is global, so a module that imports nothing can inject it.
    const env = loadEnv({ PORT: '4242' });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forEnv(env)]
    }).compile();

    expect(moduleRef.get<Env>(ENV)).toBe(env);
  });
});
