import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
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
import { ModalOverlay } from '../../internal/modal-overlay';
import { LgOverlayPlacement } from '../../internal/overlay';
import { lgLabel } from '../../tokens/labels';

let nextId = 0;

type DrawerPosition = 'left' | 'right' | 'top' | 'bottom';

// Side drawers fill the dynamic viewport height at a fixed width; bottom/top
// sheets size to their content, capped. `styleClass` with `!` overrides.
const SHEET_MAX = 'max-h-[calc(100dvh-2.5rem)]';
const POSITION_SIZE: Record<DrawerPosition, string> = {
  left: 'h-dvh w-80',
  right: 'h-dvh w-80',
  top: `w-screen ${SHEET_MAX}`,
  bottom: `w-screen ${SHEET_MAX}`
};

// The slide-in "from" state per edge, handed to the overlay as `enterFrom`.
const POSITION_HIDDEN: Record<DrawerPosition, string> = {
  left: '-translate-x-full',
  right: 'translate-x-full',
  top: '-translate-y-full',
  bottom: 'translate-y-full'
};

// A border on the edge facing the content (the inner edge).
const POSITION_BORDER: Record<DrawerPosition, string> = {
  left: 'border-e border-border',
  right: 'border-s border-border',
  top: 'border-b border-border',
  bottom: 'border-t border-border'
};

/**
 * A drawer or bottom sheet pinned to a viewport edge, over a `cdk/overlay`
 * global overlay. `visible` is **one-way** like {@link LgDialog}: backdrop
 * click, Escape and the close button emit `visibleChange(false)` for the
 * parent to re-derive it. `styleClass` merges onto the panel for sizing.
 *
 * `modal` (default true) scrims the page and traps focus. With
 * `[modal]="false"` there is neither, so everything around the drawer stays
 * visible and interactive.
 */
@Component({
  selector: 'lg-drawer',
  template: `
    <ng-template #panelTpl>
      <div
        role="dialog"
        [attr.aria-modal]="modal() ? 'true' : null"
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
                [attr.aria-label]="closeLabel()"
                class="inline-flex size-8 items-center justify-center rounded text-muted transition-colors hover:bg-content-hover hover:text-text"
                (click)="requestClose()"
              >
                <i class="ph ph-x" aria-hidden="true"></i>
              </button>
            }
          </div>
        }
        <div class="min-h-0 grow overflow-auto p-4">
          <ng-content></ng-content>
        </div>
      </div>
    </ng-template>
  `
})
export class LgDrawer implements OnDestroy {
  readonly visible = input(false, { transform: booleanAttribute });
  readonly position = input<DrawerPosition>('left');
  readonly header = input<string>();
  readonly closable = input(true, { transform: booleanAttribute });
  /** ARIA label for the close button; localize it. */
  readonly closeLabel = input(lgLabel('close'));
  readonly modal = input(true, { transform: booleanAttribute });
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
      POSITION_BORDER[pos],
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
        this.modalOverlay.open(new TemplatePortal(tpl, this.viewContainerRef), {
          placement: this.position() as LgOverlayPlacement,
          modal: this.modal(),
          dismissOnBackdrop: true,
          enterFrom: [POSITION_HIDDEN[this.position()]],
          enterTransition: ['transition-transform', 'duration-300', 'ease-out'],
          onDismiss: () => this.requestClose()
        });
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
