import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Every route renders per request. Nothing here is prerenderable: a page is
 * personalized by the visitor's session, themed by their cookie and answered in
 * one of four languages, so a build-time render would be wrong for almost
 * everyone who asks for it.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
