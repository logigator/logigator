import {
  ApplicationConfig,
  inject,
  mergeApplicationConfig,
  REQUEST
} from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_ORIGIN } from './api/server-api.interceptor';
import { SITE_ORIGIN } from './seo/site-origin';

/**
 * Where this process reaches the API. A deployment fact a bundle cannot know:
 * inside the compose network the API is a host of its own, while in the browser
 * it is a path on the same origin.
 */
const API_ORIGIN_DEFAULT = 'http://localhost:3000';

/** Only reachable if a render ever runs without a request; see `SITE_ORIGIN`. */
const SITE_ORIGIN_FALLBACK = 'https://logigator.com';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      provide: API_ORIGIN,
      useFactory: () => process.env['API_ORIGIN'] ?? API_ORIGIN_DEFAULT
    },
    {
      // The request's own origin, which is the public one: Angular builds the
      // request URL from the proxy headers it is told to trust
      // (`NG_TRUST_PROXY_HEADERS`) and refuses a host outside
      // `NG_ALLOWED_HOSTS`, so the value is both correct behind Caddy and
      // already validated — better than a second variable to keep in step.
      // `REQUEST` is typed nullable for the render modes that have none; this
      // app renders every route per request, so there is always one.
      provide: SITE_ORIGIN,
      useFactory: () =>
        new URL(inject(REQUEST)?.url ?? SITE_ORIGIN_FALLBACK).origin
    }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
