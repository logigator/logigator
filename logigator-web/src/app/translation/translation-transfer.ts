import { makeStateKey, StateKey } from '@angular/core';
import { Translation } from '@jsverse/transloco';

/** Where the server render leaves a locale table for the browser to pick up. */
export function translationStateKey(lang: string): StateKey<Translation> {
  return makeStateKey<Translation>(`translations.${lang}`);
}
