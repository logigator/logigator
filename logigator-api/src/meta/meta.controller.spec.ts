import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import { metaResponseSchema } from '@logigator/contract';
import { ENV, type Env, loadEnv } from '../config/env';
import { MetaController } from './meta.controller';
import { MetaService } from './meta.service';

async function controllerFor(env: Env): Promise<MetaController> {
  // The controller and its service are wired by Nest from constructor metadata;
  // only the environment is handed in, since that is what varies here.
  const moduleRef = await Test.createTestingModule({
    controllers: [MetaController],
    providers: [MetaService, { provide: ENV, useValue: env }]
  }).compile();

  return moduleRef.get(MetaController);
}

describe('MetaController', () => {
  it('reports the format version the shared core defines', async () => {
    const controller = await controllerFor(loadEnv({}));

    expect(metaResponseSchema.parse(controller.getMeta())).toEqual({
      formatVersion: CURRENT_FILE_VERSION,
      authProviders: ['local']
    });
  });

  it('advertises Google only where it is configured', async () => {
    // A client draws its login form from this, so it must not offer a provider
    // whose routes would answer 501.
    const controller = await controllerFor(
      loadEnv({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })
    );

    expect(controller.getMeta().authProviders).toEqual(['local', 'google']);
  });
});
