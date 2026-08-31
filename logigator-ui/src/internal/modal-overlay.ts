import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { Portal } from '@angular/cdk/portal';
import { Subscription } from 'rxjs';
import { playEnterTransition } from './fade-in';
import { createGlobalOverlay, LgOverlayPlacement } from './overlay';
import { LgFocusTrap } from './focus-trap';

export interface ModalOpenOptions {
  placement: LgOverlayPlacement;
  panelClass?: string | string[];
  /** Extra class alongside the default dark backdrop. */
  backdropClass?: string;
  /**
   * Non-modal (`false`) drops the backdrop and the focus trap, so the page
   * behind stays interactive and the panel floats over it. Defaults to true.
   */
  modal?: boolean;
  /** Whether to render (and animate) a modal backdrop. Defaults to `modal`. */
  hasBackdrop?: boolean;
  /** Dismiss when the backdrop is clicked. */
  dismissOnBackdrop?: boolean;
  /**
   * Enter-transition "from" classes for the panel, lifted once that state has
   * painted. For a from state that varies at open time, such as a drawer's
   * per-side slide-in; a fixed one belongs in LgFadeIn / LgScaleIn.
   */
  enterFrom?: string[];
  /** Transition classes accompanying `enterFrom`; they stay on the panel. */
  enterTransition?: string[];
  /** Invoked when the user asks to close (backdrop click / Escape). */
  onDismiss: () => void;
}

/**
 * Lifecycle for a modal overlay: a global `cdk/overlay`, {@link LgFocusTrap}
 * with focus restore, an `enterFrom` transition, and backdrop/Escape
 * dismissal. Closing disposes immediately — cdk still fades the backdrop out
 * — so there is no exit-animation bookkeeping.
 */
export class ModalOverlay {
  private readonly focusTrap: LgFocusTrap;
  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;

  constructor(
    private readonly overlay: Overlay,
    focusTrapFactory: ConfigurableFocusTrapFactory
  ) {
    this.focusTrap = new LgFocusTrap(focusTrapFactory);
  }

  get isOpen(): boolean {
    return this.overlayRef !== null;
  }

  open(portal: Portal<unknown>, options: ModalOpenOptions): void {
    if (this.overlayRef) {
      return;
    }
    const modal = options.modal ?? true;
    this.overlayRef = createGlobalOverlay(this.overlay, {
      placement: options.placement,
      hasBackdrop: options.hasBackdrop ?? modal,
      backdropClass: options.backdropClass
        ? ['cdk-overlay-dark-backdrop', options.backdropClass]
        : undefined,
      panelClass: options.panelClass
    });
    this.overlayRef.attach(portal);
    if (options.enterFrom?.length) {
      const panel = this.overlayRef.overlayElement.firstElementChild;
      if (panel instanceof HTMLElement) {
        playEnterTransition(
          panel,
          options.enterFrom,
          options.enterTransition ?? []
        );
      }
    }
    if (modal) {
      this.focusTrap.trapFocus(this.overlayRef.overlayElement);
    }

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
  }

  /** Dispose the overlay and restore focus. Safe to call when already closed. */
  close(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.focusTrap.release();
  }
}
