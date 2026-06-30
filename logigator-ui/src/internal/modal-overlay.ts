import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { afterPaint } from './after-paint';
import { createGlobalOverlay, LgOverlayPlacement } from './overlay';
import { LgFocusTrap } from './focus-trap';

export interface ModalOpenOptions {
  placement: LgOverlayPlacement;
  panelClass?: string | string[];
  /** Whether to render (and animate) a modal backdrop. Defaults to true. */
  hasBackdrop?: boolean;
  /** Dismiss when the backdrop is clicked. */
  dismissOnBackdrop?: boolean;
  /** Invoked when the user asks to close (backdrop click / Escape). */
  onDismiss: () => void;
}

/**
 * Lifecycle for a modal overlay (Dialog, Drawer): a global `cdk/overlay` + focus
 * trap & restore ({@link LgFocusTrap}, its first consumer) + an enter transition
 * + backdrop / Escape dismissal.
 *
 * The {@link shown} signal flips on after attach (double rAF, so the browser
 * paints the off-screen "from" state first) to play the surface in via a CSS
 * transition. Closing disposes **immediately** — the backdrop still fades out
 * via cdk — which keeps the controller small (no exit-animation bookkeeping).
 */
export class ModalOverlay {
  private readonly focusTrap: LgFocusTrap;
  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;

  /** Drives the enter-transition class on the panel (off until painted, then on). */
  readonly shown = signal(false);

  constructor(
    private readonly overlay: Overlay,
    focusTrapFactory: ConfigurableFocusTrapFactory
  ) {
    this.focusTrap = new LgFocusTrap(focusTrapFactory);
  }

  get isOpen(): boolean {
    return this.overlayRef !== null;
  }

  open(portal: TemplatePortal, options: ModalOpenOptions): void {
    if (this.overlayRef) {
      return;
    }
    this.shown.set(false);
    this.overlayRef = createGlobalOverlay(this.overlay, {
      placement: options.placement,
      hasBackdrop: options.hasBackdrop ?? true,
      panelClass: options.panelClass
    });
    this.overlayRef.attach(portal);
    this.focusTrap.trapFocus(this.overlayRef.overlayElement);

    this.subscriptions = new Subscription();
    if (options.dismissOnBackdrop) {
      this.subscriptions.add(
        this.overlayRef.backdropClick().subscribe(() => options.onDismiss())
      );
    }
    this.subscriptions.add(
      this.overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          options.onDismiss();
        }
      })
    );

    // Paint the "from" state before flipping, so the CSS enter transition runs.
    afterPaint(() => this.shown.set(true));
  }

  /** Dispose the overlay and restore focus. Safe to call when already closed. */
  close(): void {
    this.shown.set(false);
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.focusTrap.release();
  }
}
