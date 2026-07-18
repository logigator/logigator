import { ComponentRef, inject, Injectable, Injector } from '@angular/core';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ConnectedOverlayPositionChange,
  FlexibleConnectedPositionStrategy,
  OverlayRef
} from '@angular/cdk/overlay';
import { Subscription } from 'rxjs';
import {
  connectedPositions,
  LgOverlayService,
  LgOverlaySide,
  sideOfPosition
} from '@logigator/ui';
import { CoachMarkHandlers, CoachMarkView } from './coach-mark.model';
import { CoachMarkComponent } from './coach-mark/coach-mark.component';
import { CoachMarkBackdropComponent } from './coach-mark/coach-mark-backdrop.component';

/** Upper bound on waiting for an anchor to stop moving before mounting. */
const SETTLE_CAP_MS = 1000;

/**
 * Imperatively shows the tutorial coach-mark: the dim/highlight backdrop plus
 * the step bubble, built on {@link LgOverlayService}. The bubble anchors to a
 * target element (connected overlay, caret tracking the resolved side) or
 * centers when there is none; the backdrop tracks the target's rect on
 * scroll/resize so the highlight ring stays put. The coach-mark claims no
 * keyboard input — Escape stays free for the board's own cancel handling, so
 * the tutorial only ends through its own Skip control.
 *
 * Presentation only — the {@link TutorialRunner} decides which step to show and
 * supplies the handlers. One coach-mark is visible at a time.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingOverlayService {
  private readonly overlayService = inject(LgOverlayService);
  private readonly injector = inject(Injector);

  private backdropRef: OverlayRef | null = null;
  private backdropCmp: ComponentRef<CoachMarkBackdropComponent> | null = null;
  private bubbleRef: OverlayRef | null = null;
  private bubbleCmp: ComponentRef<CoachMarkComponent> | null = null;

  private target: HTMLElement | null = null;
  /** The pending step view; the bubble is mounted from it once the anchor settles. */
  private view: CoachMarkView | null = null;
  private handlers: CoachMarkHandlers | null = null;
  private subscriptions = new Subscription();
  private readonly trackRect = () => this.refreshRect();
  /**
   * Re-measures when the board resizes without a window resize — chiefly
   * entering/leaving simulation, which drops the side-bar and tab-bar and so
   * grows the canvas. Keeps the punched-out hole aligned to the new rect.
   */
  private resizeObserver: ResizeObserver | null = null;
  /** Handle for the "track until the target settles" rAF loop. */
  private settleRaf: number | null = null;
  /** One scroll-into-view attempt per shown target (guards a nudge loop). */
  private scrolledIntoView = false;

  /**
   * Shows (or, if a coach-mark is already open on the same target and side,
   * updates in place) the bubble for one step. Reusing the overlays on a
   * same-target update avoids a teardown flicker for mid-step text changes.
   */
  public show(
    target: HTMLElement | null,
    view: CoachMarkView,
    handlers: CoachMarkHandlers
  ): void {
    if (this.bubbleCmp && this.target === target) {
      // Same anchor: refresh content without rebuilding the overlays, so a
      // mid-step text change ("1 of 2 placed") doesn't flicker.
      this.handlers = handlers;
      this.view = view;
      this.bubbleCmp.setInput('view', view);
      this.trackUntilSettled();
      return;
    }

    // hide() resets handlers/target, so set them only after the teardown.
    this.hide();
    this.handlers = handlers;
    this.target = target;
    this.view = view;
    this.mountBackdrop();
    // The bubble is NOT mounted here — trackUntilSettled mounts it once the
    // anchor's rect holds still. The CDK connected overlay must never position
    // against a mid-animation origin (a palette item riding the Drawer's slide):
    // an apply against a moving/off-screen origin can drop the pane into the
    // flexible-dimensions fallback (`position: static`), a state later
    // updatePosition() calls never recover from.
    this.trackUntilSettled();

    window.addEventListener('scroll', this.trackRect, true);
    window.addEventListener('resize', this.trackRect);
    // A later layout shift (a Drawer accordion expanding, moving the anchor)
    // ends in a transition; re-measure so the coach-mark follows.
    window.addEventListener('transitionend', this.trackRect, true);
    this.observeBoard();
  }

  /**
   * Track the target each animation frame (the backdrop ring follows live via
   * {@link refreshRect}) until its rect holds steady for a couple of frames or
   * a safety cap expires, then mount the bubble on the settled anchor. A target
   * that settles outside the viewport — a palette item below its sheet's fold —
   * is scrolled into view first (once) so the bubble has a real on-screen
   * anchor. A static target settles within a few frames, so the deferred mount
   * is imperceptible.
   */
  private trackUntilSettled(): void {
    if (this.settleRaf !== null) cancelAnimationFrame(this.settleRaf);
    let lastKey = '';
    let stableFrames = 0;
    const start = performance.now();
    const step = (): void => {
      this.refreshRect();
      const rect = this.target?.getBoundingClientRect() ?? null;
      const key = rect
        ? `${rect.top},${rect.left},${rect.width},${rect.height}`
        : '';
      if (key === lastKey) stableFrames++;
      else {
        stableFrames = 0;
        lastKey = key;
      }
      const settled =
        stableFrames >= 2 || performance.now() - start > SETTLE_CAP_MS;
      if (!settled) {
        this.settleRaf = requestAnimationFrame(step);
        return;
      }
      if (rect && rect.width > 0 && !this.scrolledIntoView) {
        const clipped =
          rect.top < 0 ||
          rect.left < 0 ||
          rect.bottom > window.innerHeight ||
          rect.right > window.innerWidth;
        if (clipped) {
          this.scrolledIntoView = true;
          this.target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          lastKey = '';
          stableFrames = 0;
          this.settleRaf = requestAnimationFrame(step);
          return;
        }
      }
      this.settleRaf = null;
      this.mountPendingBubble();
    };
    step();
  }

  /** Mount the bubble for the pending view, if not already up. */
  private mountPendingBubble(): void {
    if (this.bubbleCmp || !this.view) return;
    this.mountBubble(this.target, this.view);
    this.refreshRect();
  }

  /** Tears down the coach-mark entirely. */
  public hide(): void {
    window.removeEventListener('scroll', this.trackRect, true);
    window.removeEventListener('resize', this.trackRect);
    window.removeEventListener('transitionend', this.trackRect, true);
    if (this.settleRaf !== null) {
      cancelAnimationFrame(this.settleRaf);
      this.settleRaf = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.subscriptions.unsubscribe();
    // A Subscription is single-use once unsubscribed; swap in a fresh one.
    this.subscriptions = new Subscription();
    this.bubbleRef?.dispose();
    this.backdropRef?.dispose();
    this.bubbleRef = null;
    this.bubbleCmp = null;
    this.backdropRef = null;
    this.backdropCmp = null;
    this.target = null;
    this.view = null;
    this.handlers = null;
    this.scrolledIntoView = false;
  }

  private mountBackdrop(): void {
    this.backdropRef = this.overlayService.global({
      placement: 'center',
      hasBackdrop: false,
      panelClass: 'pointer-events-none'
    });
    this.backdropCmp = this.backdropRef.attach(
      new ComponentPortal(CoachMarkBackdropComponent, null, this.injector)
    );
  }

  private mountBubble(target: HTMLElement | null, view: CoachMarkView): void {
    const centered = view.placement === 'center' || target === null;
    if (centered) {
      this.bubbleRef = this.overlayService.global({
        placement: 'center',
        hasBackdrop: false
      });
    } else {
      this.bubbleRef = this.overlayService.connected({
        origin: target,
        positions: connectedPositions(view.placement as LgOverlaySide)
      });
      this.trackCaretSide();
    }

    this.bubbleCmp = this.bubbleRef.attach(
      new ComponentPortal(CoachMarkComponent, null, this.injector)
    );
    this.bubbleCmp.setInput('view', view);
    this.wireBubbleOutputs(this.bubbleCmp);
  }

  private wireBubbleOutputs(cmp: ComponentRef<CoachMarkComponent>): void {
    this.subscriptions.add(
      cmp.instance.next.subscribe(() => this.handlers?.next?.())
    );
    this.subscriptions.add(
      cmp.instance.skip.subscribe(() => this.handlers?.skip())
    );
  }

  /** Point the caret at the anchor from whichever side CDK actually placed it. */
  private trackCaretSide(): void {
    const strategy = this.bubbleRef?.getConfig()
      .positionStrategy as FlexibleConnectedPositionStrategy;
    this.subscriptions.add(
      strategy.positionChanges.subscribe(
        (change: ConnectedOverlayPositionChange) => {
          this.bubbleCmp?.setInput(
            'side',
            sideOfPosition(change.connectionPair)
          );
        }
      )
    );
  }

  /** Watches the board for size changes that no window resize announces. */
  private observeBoard(): void {
    const board = document.querySelector('app-board');
    if (!board) return;
    this.resizeObserver = new ResizeObserver(() => this.refreshRect());
    this.resizeObserver.observe(board);
  }

  private refreshRect(): void {
    if (!this.backdropCmp) return;
    const rect = this.target?.getBoundingClientRect() ?? null;
    this.backdropCmp.setInput('targetRect', rect);
    // The board canvas is always interactive, so it is always cut out of the
    // dim; steps that only touch it (e.g. "Move around") have no other target.
    const board = document.querySelector('app-board');
    this.backdropCmp.setInput(
      'canvasRect',
      board?.getBoundingClientRect() ?? null
    );
    this.bubbleRef?.updatePosition();
  }
}
