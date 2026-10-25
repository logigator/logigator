import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { isAvailableLanguage } from '@logigator/core';
import { TranslationService } from './translation.service';

/**
 * Puts the document in the language its URL names, before the route activates.
 *
 * The `lang` segment is a route parameter, so this re-runs whenever it changes:
 * an in-app switch and the browser's back button both carry the translations
 * with them, and neither can leave a German page at an English URL. Awaiting
 * the table is what keeps a page from rendering through its keys and the head
 * it writes from naming the language it is leaving.
 *
 * A table that cannot be fetched cancels the navigation, which leaves the
 * visitor on the page they are reading rather than on an untranslated one.
 */
export const languageTableGuard: CanActivateFn = async (route) => {
  const lang = route.params['lang'] as string | undefined;
  const translation = inject(TranslationService);
  if (!isAvailableLanguage(lang) || lang === translation.getActiveLang()) {
    return true;
  }
  await translation.setActiveLang(lang);
  return true;
};
