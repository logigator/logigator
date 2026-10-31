import { DestroyRef, effect, inject, PLATFORM_ID, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ActivatedRouteSnapshot,
  CanDeactivateFn,
  RouterStateSnapshot
} from '@angular/router';
import { ConfirmationService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';

/** A routed page that can hold edits a navigation would throw away. */
export interface HoldsUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Asks before an in-app navigation leaves a page with unsaved edits.
 *
 * A navigation that keeps the route — a language switch, which only rewrites
 * the inherited `:lang` — keeps the component and its form too, so it passes
 * without asking.
 */
export const unsavedChangesGuard: CanDeactivateFn<HoldsUnsavedChanges> = (
  component,
  current,
  _currentState,
  next
) => {
  if (!component.hasUnsavedChanges() || keepsRoute(current, next)) {
    return true;
  }
  const confirmations = inject(ConfirmationService);
  const translation = inject(TranslationService);
  return new Promise<boolean>((resolve) => {
    confirmations.confirm({
      header: translation.translate('forms.unsavedChanges.header'),
      message: translation.translate('forms.unsavedChanges.message'),
      acceptLabel: translation.translate('forms.unsavedChanges.accept'),
      rejectLabel: translation.translate('forms.unsavedChanges.reject'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => resolve(true),
      reject: () => resolve(false)
    });
  });
};

function keepsRoute(
  current: ActivatedRouteSnapshot,
  next: RouterStateSnapshot
): boolean {
  const pending: ActivatedRouteSnapshot[] = [next.root];
  for (let route = pending.pop(); route; route = pending.pop()) {
    if (route.routeConfig === current.routeConfig) return true;
    pending.push(...route.children);
  }
  return false;
}

/**
 * Has the browser ask before the document unloads — a reload, a closed tab, a
 * link off the site — while `unsaved` is true. The dialog and its text are the
 * browser's.
 *
 * Bound only while there is something to lose: a registered `beforeunload`
 * listener costs the page the back/forward cache whether or not it fires.
 * Call from an injection context; it unbinds with that context.
 */
export function warnBeforeUnload(unsaved: Signal<boolean>): void {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

  const onBeforeUnload = (event: BeforeUnloadEvent): void => {
    // Effects are scheduled, so a just-saved form can still be bound.
    if (unsaved()) event.preventDefault();
  };
  let bound = false;
  const bind = (on: boolean): void => {
    if (on === bound) return;
    bound = on;
    if (on) window.addEventListener('beforeunload', onBeforeUnload);
    else window.removeEventListener('beforeunload', onBeforeUnload);
  };

  effect(() => bind(unsaved()));
  inject(DestroyRef).onDestroy(() => bind(false));
}
