import {
  FlexibleConnectedPositionStrategy,
  Overlay,
  OverlayRef
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
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
import {
  connectedPositions,
  createConnectedOverlay,
  LgOverlaySide,
  sideOfPosition
} from '../../internal/overlay';
import { LgButton } from '../button/button';
import { Confirmation } from './confirmation';
import { LgConfirmOutlet } from './confirm-outlet';

/** PrimeNG's confirm-popup gutter between the anchor and the panel. */
const POPUP_GAP = 10;

/**
 * The anchored, `key`-routed outlet for {@link ConfirmationService}. When a
 * matching confirmation arrives it opens a `cdk/overlay` connected overlay (with
 * a caret) at `confirmation.target`, with small reject/accept buttons. An
 * outside click or Escape rejects. Handles only confirmations whose `key`
 * matches its own (e.g. `key="inline"`).
 */
@Component({
  selector: 'lg-confirm-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LgButton, LgCaret],
  template: `
    <ng-template #panel>
      <div
        class="relative max-w-xs rounded-md bg-content p-3 text-text shadow-lg"
      >
        <p class="mb-3 text-sm">{{ current()?.message }}</p>
        <div class="flex justify-end gap-2">
          <lg-button
            size="small"
            [label]="current()?.rejectLabel"
            [severity]="rejectSeverity()"
            [outlined]="rejectOutlined()"
            (onClick)="reject()"
          />
          <lg-button
            size="small"
            [label]="current()?.acceptLabel"
            [severity]="acceptSeverity()"
            [outlined]="acceptOutlined()"
            (onClick)="accept()"
          />
        </div>
        <lg-caret [side]="side()" />
      </div>
    </ng-template>
  `
})
export class LgConfirmPopup extends LgConfirmOutlet implements OnDestroy {
  protected readonly side = signal<LgOverlaySide>('bottom');

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;

  protected present(confirmation: Confirmation): void {
    const target = confirmation.target;
    if (!(target instanceof HTMLElement)) {
      return; // the popup needs an anchor element
    }
    this.teardown();
    this.current.set(confirmation);
    this.side.set('bottom');
    this.overlayRef = createConnectedOverlay(this.overlay, {
      origin: target,
      positions: connectedPositions('bottom', POPUP_GAP),
      hasBackdrop: true
    });
    this.overlayRef.attach(
      new TemplatePortal(this.panel(), this.viewContainerRef)
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
      this.overlayRef.backdropClick().subscribe(() => this.reject())
    );
    this.subscriptions.add(
      this.overlayRef.keydownEvents().subscribe((event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          this.reject();
        }
      })
    );
  }

  protected override teardown(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }

  ngOnDestroy(): void {
    this.teardown();
  }
}
