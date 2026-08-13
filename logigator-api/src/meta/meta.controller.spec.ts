import { describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import { metaResponseSchema } from '@logigator/contract';
import { MetaModule } from './meta.module';
import { MetaController } from './meta.controller';

describe('MetaController', () => {
  it('reports the format version the shared core defines', async () => {
    // Built through the real module, so the controller's dependency is resolved
    // by Nest from constructor metadata rather than handed in by the spec.
    const moduleRef = await Test.createTestingModule({
      imports: [MetaModule]
    }).compile();

    const response = moduleRef.get(MetaController).getMeta();

    expect(metaResponseSchema.parse(response)).toEqual({
      formatVersion: CURRENT_FILE_VERSION
    });
  });
});
