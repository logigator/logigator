import { inject } from '@angular/core';
import { PlatformLocation } from '@angular/common';
import { languageFromPath } from './language-url';
import { DEFAULT_LANGUAGE, LanguageId } from './languages';

/**
 * The language this document renders in, read from the URL's first segment.
 *
 * `PlatformLocation` answers on both platforms — from the incoming request
 * during a server render, from `location` after hydration — so the two agree by
 * construction. A URL with no prefix has been redirected by the SSR server
 * before it gets here; the default covers the routes that outlive that, such as
 * a 404 for a first segment that is not a language.
 *
 * Must run inside an injection context.
 */
export function resolveDocumentLanguage(): LanguageId {
  const pathname = inject(PlatformLocation).pathname;
  return languageFromPath(pathname) ?? DEFAULT_LANGUAGE;
}
