import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  Component,
  inject,
  OnDestroy,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import { LgCaret } from '../../internal/caret';
import { LgFadeIn } from '../../internal/fade-in';
import {
  caretSideChanges,
  connectedPositions,
  createConnectedOverlay,
  externalTeardown,
  LgOverlaySide
} from '../../internal/overlay';

/**
 * A click-triggered popover. The trigger calls `toggle($event)`, anchoring to
 * the event target, or `hide()`; the content sits in a connected overlay with
 * a caret, is instantiated only while open, and dismisses on outside-click or
 * Escape.
 */
@Component({
  selector: 'lg-popover',
  imports: [LgCaret, LgFadeIn],
  template: `
    <ng-template #content>
      <div
        lgFadeIn
        class="relative rounded-md border border-border bg-content p-3 shadow-md"
      >
        <ng-content></ng-content>
        <lg-caret [side]="side()" />
      </div>
    </ng-template>
  `
})
export class LgPopover implements OnDestroy {
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly content =
    viewChild.required<TemplateRef<unknown>>('content');

  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;

  protected readonly side = signal<LgOverlaySide>('bottom');

  toggle(event: Event): void {
    if (this.overlayRef) {
      this.hide();
      return;
    }
    this.open((event.currentTarget ?? event.target) as HTMLElement);
  }

  hide(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  ngOnDestroy(): void {
    this.hide();
  }

  private open(origin: HTMLElement): void {
    this.side.set('bottom');
    this.overlayRef = createConnectedOverlay(this.overlay, {
      origin,
      positions: connectedPositions('bottom'),
      hasBackdrop: true
    });
    this.overlayRef.attach(
      new TemplatePortal(this.content(), this.viewContainerRef)
    );

    this.subscriptions = new Subscription();
    this.subscriptions.add(
      caretSideChanges(this.overlayRef).subscribe((side) => this.side.set(side))
    );
    this.subscriptions.add(
      this.overlayRef.backdropClick().subscribe(() => this.hide())
    );
    this.subscriptions.add(
      externalTeardown(this.overlayRef, () => {
        this.overlayRef = null;
        this.hide();
      })
    );
    this.subscriptions.add(
      this.overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.hide();
        }
      })
    );
  }
}
