import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { ModalOverlay } from '../internal/modal-overlay';
import { LgOverlayPlacement } from '../internal/overlay';

let nextId = 0;

type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';

/** Default cross-axis size per edge; `styleClass` (with `!`) overrides it. */
const POSITION_SIZE: Record<DrawerPosition, string> = {
  left: 'h-screen w-80',
  right: 'h-screen w-80',
  top: 'w-screen h-[50vh]',
  bottom: 'w-screen h-[50vh]'
};

const POSITION_SHOWN: Record<DrawerPosition, string> = {
  left: 'translate-x-0',
  right: 'translate-x-0',
  top: 'translate-y-0',
  bottom: 'translate-y-0'
};

const POSITION_HIDDEN: Record<DrawerPosition, string> = {
  left: '-translate-x-full',
  right: 'translate-x-full',
  top: '-translate-y-full',
  bottom: 'translate-y-full'
};

/**
 * A modal drawer (side / bottom sheet) pinned to a viewport edge. `visible` is
 * **one-way** like {@link LgDialog} — backdrop click, Escape, or the close
 * button emit `visibleChange(false)` for the parent to re-derive `visible`.
 * Edge-pinned over a `cdk/overlay` global overlay with focus trap + restore;
 * slides in from its edge. Default content is projected; `styleClass` is merged
 * onto the panel (e.g. `h-[90vh]!` to resize a bottom sheet).
 */
@Component({
  selector: 'lg-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #panelTpl>
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="header() ? headerId : null"
        [class]="panelClasses()"
      >
        @if (header() || closable()) {
          <div
            class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3"
          >
            <h2 [id]="headerId" class="text-base font-semibold text-text">
              {{ header() }}
            </h2>
            @if (closable()) {
              <button
                type="button"
                aria-label="Close"
                class="inline-flex size-8 items-center justify-center rounded text-muted transition-colors hover:bg-content-hover hover:text-text"
                (click)="requestClose()"
              >
                <i class="ph ph-x" aria-hidden="true"></i>
              </button>
            }
          </div>
        }
        <div class="min-h-0 grow overflow-auto p-4"><ng-content></ng-content></div>
      </div>
    </ng-template>
  `
})
export class LgDrawer implements OnDestroy {
  readonly visible = input(false, { transform: booleanAttribute });
  readonly position = input<DrawerPosition>('left');
  readonly header = input<string>();
  readonly closable = input(true, { transform: booleanAttribute });
  readonly styleClass = input<string>('');
  readonly visibleChange = output<boolean>();

  private readonly panelTpl = viewChild<TemplateRef<unknown>>('panelTpl');

  protected readonly headerId = `lg-drawer-${++nextId}`;

  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly modalOverlay = new ModalOverlay(
    inject(Overlay),
    inject(ConfigurableFocusTrapFactory)
  );

  protected readonly panelClasses = computed(() => {
    const pos = this.position();
    return [
      'flex flex-col bg-content text-text shadow-xl',
      POSITION_SIZE[pos],
      'transition-transform duration-300 ease-out',
      this.modalOverlay.shown() ? POSITION_SHOWN[pos] : POSITION_HIDDEN[pos],
      this.styleClass()
    ].join(' ');
  });

  constructor() {
    effect(() => {
      const open = this.visible();
      const tpl = this.panelTpl();
      if (!tpl) {
        return;
      }
      if (open) {
        this.modalOverlay.open(
          new TemplatePortal(tpl, this.viewContainerRef),
          {
            placement: this.position() as LgOverlayPlacement,
            dismissOnBackdrop: true,
            onDismiss: () => this.requestClose()
          }
        );
      } else {
        this.modalOverlay.close();
      }
    });
  }

  protected requestClose(): void {
    this.visibleChange.emit(false);
  }

  ngOnDestroy(): void {
    this.modalOverlay.close();
  }
}
