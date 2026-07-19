import { ComponentRef, inject, Injectable, Injector } from '@angular/core';
import { ComponentPortal } from '@angular/cdk/portal';
import { OverlayRef } from '@angular/cdk/overlay';
import { Subscription } from 'rxjs';
import {
  caretSideChanges,
  connectedPositions,
  LgOverlayService
} from '@logigator/ui';
import { CoachMarkHandlers, CoachMarkView } from './coach-mark.model';
import { CoachMarkComponent } from './coach-mark/coach-mark.component';
import { CoachMarkBackdropComponent } from './coach-mark/coach-mark-backdrop.component';
import { OnboardingTargetRegistry } from './onboarding-target-registry.service';

/** Upper bound on waiting for an anchor to stop moving before mounting. */
const SETTLE_CAP_MS = 1000;

/** Onboarding target id of the board canvas (registered in the app shell). */
const BOARD_TARGET_ID = 'board';

/** Everything one showing coach-mark owns; {@link hide} disposes it as a unit. */
interface CoachMarkSession {
  target: HTMLElement | null;
  /** The step view; mutable so a same-target update swaps it in place. */
  view: CoachMarkView;
  handlers: CoachMarkHandlers;
  readonly backdropRef: OverlayRef;
  readonly backdropCmp: ComponentRef<CoachMarkBackdropComponent>;
  /** The bubble mounts only once the anchor settles; null until then. */
  bubbleRef: OverlayRef | null;
  bubbleCmp: ComponentRef<CoachMarkComponent> | null;
  readonly subscriptions: Subscription;
  resizeObserver: ResizeObserver | null;
  /** Handle for the "track until the target settles" rAF loop. */
  settleRaf: number | null;
  /** One scroll-into-view attempt per shown target (guards a nudge loop). */
  scrolledIntoView: boolean;
}

/**
 * Imperatively shows the tutorial coach-mark: the dim/highlight backdrop plus
 * the step bubble, built on {@link LgOverlayService}. The bubble anchors to a
 * target element (connected overlay, caret tracking the resolved side) or
 * centers when there is none; the backdrop tracks the target's rect on
 * scroll/resize so the highlight ring stays put. The coach-mark claims no
 * keyboard input — Escape stays free for the board's own cancel handling, so
 * the tutorial only ends through its own Skip control.
 *
 * Presentation only — the {@link TutorialRunnerService} decides which step to
 * show and supplies the handlers. One coach-mark is visible at a time.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingOverlayService {
  private readonly overlayService = inject(LgOverlayService);
  private readonly injector = inject(Injector);
  private readonly registry = inject(OnboardingTargetRegistry);

  /** The showing coach-mark, or null. */
  private session: CoachMarkSession | null = null;
  private readonly trackRect = () => this.refreshRect();

  /**
   * Shows (or, if a coach-mark is already open on the same target, updates in
   * place) the bubble for one step. Reusing the overlays on a same-target
   * update avoids a teardown flicker for mid-step text changes.
   */
  public show(
    target: HTMLElement | null,
    view: CoachMarkView,
    handlers: CoachMarkHandlers
  ): void {
    const current = this.session;
    if (current?.bubbleCmp && current.target === target) {
      // Same anchor: refresh content without rebuilding the overlays, so a
      // mid-step text change ("1 of 2 placed") doesn't flicker.
      current.handlers = handlers;
      current.view = view;
      current.bubbleCmp.setInput('view', view);
      this.trackUntilSettled(current);
      return;
    }

    this.hide();
    const session = this.createSession(target, view, handlers);
    this.session = session;
    // The bubble is NOT mounted here — trackUntilSettled mounts it once the
    // anchor's rect holds still. The CDK connected overlay must never position
    // against a mid-animation origin (a palette item riding the Drawer's slide):
    // an apply against a moving/off-screen origin can drop the pane into the
    // flexible-dimensions fallback (`position: static`), a state later
    // updatePosition() calls never recover from.
    this.trackUntilSettled(session);

    window.addEventListener('scroll', this.trackRect, true);
    window.addEventListener('resize', this.trackRect);
    // A later layout shift (a Drawer accordion expanding, moving the anchor)
    // ends in a transition; re-measure so the coach-mark follows.
    window.addEventListener('transitionend', this.trackRect, true);
    this.observeBoard(session);
  }

  /** Tears down the coach-mark entirely. */
  public hide(): void {
    const session = this.session;
    if (!session) return;
    this.session = null;
    window.removeEventListener('scroll', this.trackRect, true);
    window.removeEventListener('resize', this.trackRect);
    window.removeEventListener('transitionend', this.trackRect, true);
    if (session.settleRaf !== null) cancelAnimationFrame(session.settleRaf);
    session.resizeObserver?.disconnect();
    session.subscriptions.unsubscribe();
    session.bubbleRef?.dispose();
    session.backdropRef.dispose();
  }

  /** A fresh session with the dim/highlight backdrop up and no bubble yet. */
  private createSession(
    target: HTMLElement | null,
    view: CoachMarkView,
    handlers: CoachMarkHandlers
  ): CoachMarkSession {
    const backdropRef = this.overlayService.global({
      placement: 'center',
      hasBackdrop: false,
      panelClass: 'pointer-events-none'
    });
    const backdropCmp = backdropRef.attach(
      new ComponentPortal(CoachMarkBackdropComponent, null, this.injector)
    );
    return {
      target,
      view,
      handlers,
      backdropRef,
      backdropCmp,
      bubbleRef: null,
      bubbleCmp: null,
      subscriptions: new Subscription(),
      resizeObserver: null,
      settleRaf: null,
      scrolledIntoView: false
    };
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
  private trackUntilSettled(session: CoachMarkSession): void {
    if (session.settleRaf !== null) cancelAnimationFrame(session.settleRaf);
    let lastKey = '';
    let stableFrames = 0;
    const start = performance.now();
    const step = (): void => {
      this.refreshRect();
      const rect = session.target?.getBoundingClientRect() ?? null;
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
        session.settleRaf = requestAnimationFrame(step);
        return;
      }
      if (rect && rect.width > 0 && !session.scrolledIntoView) {
        const clipped =
          rect.top < 0 ||
          rect.left < 0 ||
          rect.bottom > window.innerHeight ||
          rect.right > window.innerWidth;
        if (clipped) {
          session.scrolledIntoView = true;
          session.target?.scrollIntoView({
            block: 'nearest',
            inline: 'nearest'
          });
          lastKey = '';
          stableFrames = 0;
          session.settleRaf = requestAnimationFrame(step);
          return;
        }
      }
      session.settleRaf = null;
      this.mountBubble(session);
    };
    step();
  }

  /** Mount the bubble on the settled anchor, if not already up. */
  private mountBubble(session: CoachMarkSession): void {
    if (session.bubbleCmp) return;
    const { target, view } = session;
    const placement = view.placement;
    const centered = placement === 'center' || target === null;
    session.bubbleRef = centered
      ? this.overlayService.global({ placement: 'center', hasBackdrop: false })
      : this.overlayService.connected({
          origin: target,
          positions: connectedPositions(placement)
        });

    const cmp = session.bubbleRef.attach(
      new ComponentPortal(CoachMarkComponent, null, this.injector)
    );
    cmp.setInput('view', view);
    session.bubbleCmp = cmp;
    session.subscriptions.add(
      cmp.instance.next.subscribe(() => session.handlers.next())
    );
    session.subscriptions.add(
      cmp.instance.skip.subscribe(() => session.handlers.skip())
    );
    if (!centered) {
      // Point the caret at the anchor from whichever side CDK actually placed it.
      session.subscriptions.add(
        caretSideChanges(session.bubbleRef).subscribe((side) =>
          cmp.setInput('side', side)
        )
      );
    }
    this.refreshRect();
  }

  /** Watches the board for size changes that no window resize announces. */
  private observeBoard(session: CoachMarkSession): void {
    const board = this.registry.get(BOARD_TARGET_ID);
    if (!board) return;
    session.resizeObserver = new ResizeObserver(() => this.refreshRect());
    session.resizeObserver.observe(board);
  }

  private refreshRect(): void {
    const session = this.session;
    if (!session) return;
    session.backdropCmp.setInput(
      'targetRect',
      session.target?.getBoundingClientRect() ?? null
    );
    // The board canvas is always interactive, so it is always cut out of the
    // dim; steps that only touch it (e.g. "Move around") have no other target.
    const board = this.registry.get(BOARD_TARGET_ID);
    session.backdropCmp.setInput(
      'canvasRect',
      board?.getBoundingClientRect() ?? null
    );
    session.bubbleRef?.updatePosition();
  }
}
