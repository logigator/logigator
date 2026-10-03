import { Inject, Injectable } from '@nestjs/common';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import type { MetaResponse } from '@logigator/contract';
import { isGoogleAuthConfigured } from '../auth/google-auth.config';
import { ENV, type Env } from '../config/env';

@Injectable()
export class MetaService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * What clients need to know before they upload anything or draw a login form.
   * The format version comes from the shared core, which is also what the write
   * path normalizes documents to — one constant, both sides of the wire.
   */
  getMeta(): MetaResponse {
    return {
      formatVersion: CURRENT_FILE_VERSION,
      authProviders: isGoogleAuthConfigured(this.env)
        ? ['local', 'google']
        : ['local']
    };
  }
}
