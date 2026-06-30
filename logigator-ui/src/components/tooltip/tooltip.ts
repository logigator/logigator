import { AriaDescriber } from '@angular/cdk/a11y';
import {
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayRef
} from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  ComponentRef,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  ViewContainerRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  connectedPositions,
  createConnectedOverlay,
  LgOverlaySide,
  sideOfPosition
} from '../../internal/overlay';
import { LgTooltipPanel } from './tooltip-panel';

/**
 * A hover/focus tooltip on any host element. The content is the `lgTooltip`
 * value; an **empty / null value is a no-op** (renders no tooltip). The bubble
 * is a `cdk/overlay` connected overlay with a caret tracking the anchor; the
 * directive never steals pointer or focus, and registers the text with
 * `AriaDescriber` so it reaches screen readers via `aria-describedby`.
 */
@Directive({
  selector: '[lgTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focusin)': 'show()',
    '(focusout)': 'hide()',
    '(keydown.escape)': 'hide()'
  }
})
export class LgTooltip implements OnDestroy {
  readonly content = input<string | null | undefined>(undefined, {
    alias: 'lgTooltip'
  });
  readonly tooltipPosition = input<LgOverlaySide>('right');

  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly ariaDescriber = inject(AriaDescriber);

  private overlayRef: OverlayRef | null = null;
  private panelRef: ComponentRef<LgTooltipPanel> | null = null;
  private positionsSub: Subscription | null = null;

  constructor() {
    // Keep aria-describedby in sync with the content (cleanup removes the
    // previous hidden description on change and on destroy).
    effect((onCleanup) => {
      const text = this.content();
      const el = this.host.nativeElement;
      if (text) {
        this.ariaDescriber.describe(el, text);
        onCleanup(() => this.ariaDescriber.removeDescription(el, text));
      }
    });

    // Keep an already-visible bubble in sync when the content changes (a cleared
    // value hides it, matching show()'s no-op-on-empty contract).
    effect(() => {
      const text = this.content();
      if (!this.overlayRef) {
        return;
      }
      if (text) {
        this.panelRef?.setInput('text', text);
      } else {
        this.hide();
      }
    });
  }

  ngOnDestroy(): void {
    this.hide();
  }

  protected show(): void {
    const text = this.content();
    if (!text || this.overlayRef) {
      return;
    }
    const side = this.tooltipPosition();
    this.overlayRef = createConnectedOverlay(this.overlay, {
      origin: this.host,
      positions: connectedPositions(side),
      panelClass: 'lg-tooltip'
    });
    this.panelRef = this.overlayRef.attach(
      new ComponentPortal(LgTooltipPanel, this.viewContainerRef)
    );
    this.panelRef.setInput('text', text);
    this.panelRef.setInput('side', side);

    const strategy = this.overlayRef.getConfig()
      .positionStrategy as FlexibleConnectedPositionStrategy;
    this.positionsSub = strategy.positionChanges.subscribe((change) => {
      this.panelRef?.setInput('side', sideOfPosition(change.connectionPair));
    });
  }

  protected hide(): void {
    this.positionsSub?.unsubscribe();
    this.positionsSub = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.panelRef = null;
  }
}
