import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, Injector, Type } from '@angular/core';
import { Subscription } from 'rxjs';
import { LgFocusTrap } from '../internal/focus-trap';
import { createGlobalOverlay } from '../internal/overlay';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';
import {
  DIALOG_CHILD_COMPONENT,
  LgDynamicDialogContainer
} from './dynamic-dialog-container';

/**
 * Opens components in a modal dialog imperatively — the in-house replacement for
 * PrimeNG's `DialogService`. Centred over a `cdk/overlay` global overlay with a
 * backdrop, focus trap + restore, and Escape / (optional) backdrop dismissal.
 * `root`-provided, so no provider wiring is needed at call sites.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly overlay = inject(Overlay);
  private readonly focusTrapFactory = inject(ConfigurableFocusTrapFactory);
  private readonly parentInjector = inject(Injector);

  open<C, R = unknown>(
    component: Type<C>,
    config: DialogConfig = {}
  ): DialogRef<R> {
    const modal = config.modal ?? true;
    const overlayRef = createGlobalOverlay(this.overlay, {
      placement: 'center',
      hasBackdrop: modal
    });
    const focusTrap = new LgFocusTrap(this.focusTrapFactory);
    const subscription = new Subscription();

    const dialogRef = new DialogRef<R>(() => {
      subscription.unsubscribe();
      focusTrap.release();
      overlayRef.dispose();
    });

    const injector = Injector.create({
      parent: this.parentInjector,
      providers: [
        { provide: DialogRef, useValue: dialogRef },
        { provide: DialogConfig, useValue: config },
        { provide: DIALOG_CHILD_COMPONENT, useValue: component }
      ]
    });

    overlayRef.attach(
      new ComponentPortal(LgDynamicDialogContainer, null, injector)
    );
    focusTrap.trapFocus(overlayRef.overlayElement);

    subscription.add(
      overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          dialogRef.close();
        }
      })
    );
    if (modal && (config.dismissableMask ?? false)) {
      subscription.add(
        overlayRef.backdropClick().subscribe(() => dialogRef.close())
      );
    }
    // Any other teardown of the overlay (e.g. navigation) settles the ref too,
    // so `firstValueFrom(onClose)` never hangs. The settled guard makes the
    // close()→dispose()→detachment→close() re-entry a no-op.
    subscription.add(
      overlayRef.detachments().subscribe(() => dialogRef.close())
    );

    return dialogRef;
  }
}
