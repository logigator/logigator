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
  input,
  OnDestroy,
  signal,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import {
  caretClasses,
  connectedPositions,
  createConnectedOverlay,
  LgOverlaySide,
  sideOfPosition
} from '../internal/overlay';
import { LgButton } from '../button/button';
import { Confirmation } from './confirmation';
import { ConfirmationService } from './confirmation.service';

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
  imports: [LgButton],
  template: `
    <ng-template #panel>
      <div class="relative max-w-xs rounded-md bg-content p-3 text-text shadow-lg">
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
        <span aria-hidden="true" class="absolute h-0 w-0" [class]="arrow()"></span>
      </div>
    </ng-template>
  `
})
export class LgConfirmPopup implements OnDestroy {
  readonly key = input<string>();
  protected readonly current = signal<Confirmation | null>(null);
  protected readonly side = signal<LgOverlaySide>('bottom');
  protected readonly arrow = computed(() => caretClasses(this.side()));

  protected readonly acceptSeverity = computed(
    () => this.current()?.acceptButtonProps?.severity
  );
  protected readonly acceptOutlined = computed(
    () => this.current()?.acceptButtonProps?.outlined ?? false
  );
  protected readonly rejectSeverity = computed(
    () => this.current()?.rejectButtonProps?.severity ?? 'secondary'
  );
  protected readonly rejectOutlined = computed(
    () => this.current()?.rejectButtonProps?.outlined ?? false
  );

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly panel = viewChild.required<TemplateRef<unknown>>('panel');

  private overlayRef: OverlayRef | null = null;
  private subscriptions: Subscription | null = null;

  constructor() {
    inject(ConfirmationService)
      .requireConfirmation$.pipe(takeUntilDestroyed())
      .subscribe((c) => {
        if ((c.key ?? undefined) === (this.key() ?? undefined)) {
          this.show(c);
        }
      });
  }

  ngOnDestroy(): void {
    this.dispose();
  }

  private show(confirmation: Confirmation): void {
    this.dispose();
    const target = confirmation.target;
    if (!(target instanceof HTMLElement)) {
      return; // the popup needs an anchor element
    }
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

  protected accept(): void {
    this.settle()?.accept?.();
  }

  protected reject(): void {
    this.settle()?.reject?.();
  }

  private settle(): Confirmation | null {
    const confirmation = this.current();
    this.dispose();
    this.current.set(null);
    return confirmation;
  }

  private dispose(): void {
    this.subscriptions?.unsubscribe();
    this.subscriptions = null;
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
