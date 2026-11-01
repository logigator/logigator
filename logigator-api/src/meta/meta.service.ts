import { Inject, Injectable } from '@nestjs/common';
import { CURRENT_FILE_VERSION } from '@logigator/core';
import type { MetaResponse } from '@logigator/contract';
import manifest from '../../../package.json';
import { isGoogleAuthConfigured } from '../auth/google-auth.config';
import { ENV, type Env } from '../config/env';

/**
 * The product version is the root manifest's; the API's own stays `0.0.0`.
 * The manifest is a default import because Rspack links JSON as a
 * default-exporting module; it still bundles only `version`.
 * The commit and date are stamped by the release image's build arguments.
 */
const build: MetaResponse['build'] = {
  version: manifest.version,
  commit: GIT_COMMIT || null,
  date: BUILD_DATE || null
};

@Injectable()
export class MetaService {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /**
   * What clients need to know before they upload anything, draw a login form,
   * show a challenge or load analytics.
   * The format version comes from the shared core, which is also what the write
   * path normalizes documents to — one constant, both sides of the wire.
   */
  getMeta(): MetaResponse {
    return {
      formatVersion: CURRENT_FILE_VERSION,
      authProviders: isGoogleAuthConfigured(this.env)
        ? ['local', 'google']
        : ['local'],
      turnstileSiteKey: this.env.TURNSTILE_SITE_KEY ?? null,
      posthogKey: this.env.POSTHOG_KEY ?? null,
      build
    };
  }
}
