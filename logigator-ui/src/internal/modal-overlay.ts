import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Subscription } from 'rxjs';
import { playEnterTransition } from './fade-in';
import { createGlobalOverlay, LgOverlayPlacement } from './overlay';
import { LgFocusTrap } from './focus-trap';

export interface ModalOpenOptions {
  placement: LgOverlayPlacement;
  panelClass?: string | string[];
  /** Whether to render (and animate) a modal backdrop. Defaults to true. */
  hasBackdrop?: boolean;
  /** Dismiss when the backdrop is clicked. */
  dismissOnBackdrop?: boolean;
  /**
   * Enter-transition "from" classes for the panel (the portal's root element),
   * lifted once the from state has painted (see {@link playEnterTransition}).
   * For a caller whose from state varies at open time (the Drawer's per-side
   * slide-in); a fixed from state belongs in LgFadeIn / LgScaleIn instead.
   */
  enterFrom?: string[];
  /** Transition classes accompanying `enterFrom`; they stay on the panel. */
  enterTransition?: string[];
  /** Invoked when the user asks to close (backdrop click / Escape). */
  onDismiss: () => void;
}

/**
 * Lifecycle for a modal overlay (Dialog, Drawer): a global `cdk/overlay` + focus
 * trap & restore ({@link LgFocusTrap}, its first consumer) + an enter transition
 * (`enterFrom`) + backdrop / Escape dismissal.
 *
 * Closing disposes **immediately** — the backdrop still fades out via cdk —
 * which keeps the controller small (no exit-animation bookkeeping).
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

  open(portal: TemplatePortal, options: ModalOpenOptions): void {
    if (this.overlayRef) {
      return;
    }
    this.overlayRef = createGlobalOverlay(this.overlay, {
      placement: options.placement,
      hasBackdrop: options.hasBackdrop ?? true,
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
