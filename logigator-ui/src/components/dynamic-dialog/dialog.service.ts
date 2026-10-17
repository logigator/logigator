import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { inject, Injectable, Injector, Type } from '@angular/core';
import { Subscription } from 'rxjs';
import { LgFocusTrap } from '../../internal/focus-trap';
import { createGlobalOverlay } from '../../internal/overlay';
import { DialogConfig } from './dialog-config';
import { DialogDataOf, DialogResultOf } from './dialog-content';
import { DialogRef } from './dialog-ref';
import { LG_DIALOG_TELEMETRY } from './dialog-telemetry';
import {
  DIALOG_CHILD_COMPONENT,
  LgDynamicDialogContainer
} from './dynamic-dialog-container';

/**
 * Opens components in a modal dialog imperatively: centred over a `cdk/overlay`
 * global overlay with a backdrop, focus trap and restore, and Escape or
 * optional backdrop dismissal.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly overlay = inject(Overlay);
  private readonly focusTrapFactory = inject(ConfigurableFocusTrapFactory);
  private readonly parentInjector = inject(Injector);
  private readonly telemetry = inject(LG_DIALOG_TELEMETRY, { optional: true });

  open<C, R = DialogResultOf<C>>(
    component: Type<C>,
    config: DialogConfig<DialogDataOf<C>, C> = {}
  ): DialogRef<R, C> {
    const modal = config.modal ?? true;
    const overlayRef = createGlobalOverlay(this.overlay, {
      placement: 'center',
      hasBackdrop: modal
    });
    const focusTrap = new LgFocusTrap(this.focusTrapFactory);
    const subscription = new Subscription();

    const dialogRef = new DialogRef<R, C>(() => {
      subscription.unsubscribe();
      focusTrap.release();
      overlayRef.dispose();
    });

    // Wired before the child attaches, so a dialog closing itself from its own
    // constructor is still reported. Not on `subscription`: the disposer
    // unsubscribes that bag *before* `onClose` emits.
    const telemetryId = config.telemetryId;
    if (telemetryId !== undefined) {
      this.notifyTelemetry(() => this.telemetry?.onOpen(telemetryId));
      dialogRef.onClose.subscribe((result) =>
        this.notifyTelemetry(() =>
          this.telemetry?.onClose(telemetryId, result !== undefined)
        )
      );
    }

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
    // Any other teardown settles the ref too, so `firstValueFrom(onClose)`
    // never hangs; the settled guard makes the re-entry a no-op.
    subscription.add(
      overlayRef.detachments().subscribe(() => dialogRef.close())
    );

    return dialogRef;
  }

  /** An observer that throws must not take the dialog down with it. */
  private notifyTelemetry(notify: () => void): void {
    try {
      notify();
    } catch {
      // The dialog lifecycle does not depend on telemetry.
    }
  }
}
