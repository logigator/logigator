import {
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayRef
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { Subscription } from 'rxjs';
import {
  caretClasses,
  connectedPositions,
  createConnectedOverlay,
  LgOverlaySide,
  sideOfPosition
} from '../internal/overlay';

/**
 * A click-triggered popover. The trigger calls `toggle($event)` (anchors to the
 * event target) and `hide()`; the projected content is shown in a `cdk/overlay`
 * connected overlay below the anchor, with a caret, and dismisses on
 * outside-click (transparent backdrop) or Escape. The content is only
 * instantiated while open.
 */
@Component({
  selector: 'lg-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content>
      <div class="relative rounded-md bg-content p-1 shadow-lg">
        <ng-content></ng-content>
        <span
          aria-hidden="true"
          class="absolute h-0 w-0"
          [class]="arrow()"
        ></span>
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
  protected readonly arrow = computed(() => caretClasses(this.side()));

  /** Open anchored to the event target, or close if already open. */
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

    const strategy = this.overlayRef.getConfig()
      .positionStrategy as FlexibleConnectedPositionStrategy;
    this.subscriptions = new Subscription();
    this.subscriptions.add(
      strategy.positionChanges.subscribe((change) =>
        this.side.set(sideOfPosition(change.connectionPair))
      )
    );
    this.subscriptions.add(
      this.overlayRef.backdropClick().subscribe(() => this.hide())
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
