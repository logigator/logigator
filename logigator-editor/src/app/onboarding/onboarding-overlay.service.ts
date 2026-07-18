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

/**
 * Imperatively shows the tutorial coach-mark: the dim/highlight backdrop plus
 * the step bubble, built on {@link LgOverlayService}. The bubble anchors to a
 * target element (connected overlay, caret tracking the resolved side) or
 * centers when there is none; the backdrop tracks the target's rect on
 * scroll/resize so the highlight ring stays put. Escape maps to skip.
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
  private handlers: CoachMarkHandlers | null = null;
  private subscriptions = new Subscription();
  private readonly trackRect = () => this.refreshRect();
  // Global (capture-phase) Escape → skip: the backdrop is click-through and
  // focus stays on the board/toolbar, so Escape must be caught anywhere rather
  // than routed to a focused overlay.
  private readonly onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.handlers?.skip();
    }
  };

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
      this.bubbleCmp.setInput('view', view);
      this.refreshRect();
      return;
    }

    // hide() resets handlers/target, so set them only after the teardown.
    this.hide();
    this.handlers = handlers;
    this.target = target;
    this.mountBackdrop();
    this.mountBubble(target, view);
    this.refreshRect();

    window.addEventListener('scroll', this.trackRect, true);
    window.addEventListener('resize', this.trackRect);
    document.addEventListener('keydown', this.onKeydown, true);
  }

  /** Tears down the coach-mark entirely. */
  public hide(): void {
    window.removeEventListener('scroll', this.trackRect, true);
    window.removeEventListener('resize', this.trackRect);
    document.removeEventListener('keydown', this.onKeydown, true);
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
    this.handlers = null;
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

  private refreshRect(): void {
    if (!this.backdropCmp) return;
    const rect = this.target?.getBoundingClientRect() ?? null;
    this.backdropCmp.setInput('targetRect', rect);
    this.bubbleRef?.updatePosition();
  }
}
