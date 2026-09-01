import { AriaDescriber } from '@angular/cdk/a11y';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
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
  caretSideChanges,
  connectedPositions,
  createConnectedOverlay,
  externalTeardown,
  LgOverlaySide
} from '../../internal/overlay';
import { formatShortcutLabel, LgShortcutBinding } from '../shortcut/shortcut';
import { LgTooltipPanel } from './tooltip-panel';

/**
 * A hover/focus tooltip on any host element. The content is the `lgTooltip`
 * value; an **empty / null value is a no-op** (renders no tooltip). An optional
 * `tooltipShortcut` binding renders as key chips after the text. The bubble
 * is a `cdk/overlay` connected overlay with a caret tracking the anchor; the
 * directive never steals pointer or focus, and registers the text (plus the
 * shortcut's plain label) with `AriaDescriber` so it reaches screen readers via
 * `aria-describedby`.
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
  readonly tooltipShortcut = input<LgShortcutBinding | null>(null);
  readonly tooltipPosition = input<LgOverlaySide>('right');

  private readonly overlay = inject(Overlay);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly ariaDescriber = inject(AriaDescriber);

  private overlayRef: OverlayRef | null = null;
  private panelRef: ComponentRef<LgTooltipPanel> | null = null;
  private subscriptions: Subscription | null = null;

  constructor() {
    // Keep aria-describedby in sync with the content (cleanup removes the
    // previous hidden description on change and on destroy).
    effect((onCleanup) => {
      const text = this.content();
      const el = this.host.nativeElement;
      if (text) {
        const description = this.describedText(text);
        this.ariaDescriber.describe(el, description);
        onCleanup(() => this.ariaDescriber.removeDescription(el, description));
      }
    });

    // Keep an already-visible bubble in sync when the content changes (a cleared
    // value hides it, matching show()'s no-op-on-empty contract).
    effect(() => {
      const text = this.content();
      const shortcut = this.tooltipShortcut();
      if (!this.overlayRef) {
        return;
      }
      if (text) {
        this.panelRef?.setInput('text', text);
        this.panelRef?.setInput('shortcut', shortcut);
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
    this.panelRef.setInput('shortcut', this.tooltipShortcut());
    this.panelRef.setInput('side', side);

    this.subscriptions = new Subscription();
    this.subscriptions.add(
      caretSideChanges(this.overlayRef).subscribe((resolvedSide) =>
        this.panelRef?.setInput('side', resolvedSide)
      )
    );
    this.subscriptions.add(
      externalTeardown(this.overlayRef, () => {
        this.overlayRef = null;
        this.hide();
      })
    );
  }

  protected hide(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
    this.panelRef = null;
  }

  /** The screen-reader description: the text plus the shortcut's plain label. */
  private describedText(text: string): string {
    const shortcut = this.tooltipShortcut();
    return shortcut ? `${text} (${formatShortcutLabel(shortcut)})` : text;
  }
}
