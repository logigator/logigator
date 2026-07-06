import { NgStyle, NgTemplateOutlet } from '@angular/common';
import { ConfigurableFocusTrapFactory } from '@angular/cdk/a11y';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  booleanAttribute,
  Component,
  contentChild,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  TemplateRef,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { LgScaleIn } from '../../internal/fade-in';
import { ModalOverlay } from '../../internal/modal-overlay';

let nextId = 0;

/**
 * A declarative modal dialog. `visible` is **one-way**: the dialog opens/closes
 * as the bound value changes, and a close request (backdrop — only when
 * `dismissableMask` — / Escape / the close button) emits `visibleChange(false)`
 * for the parent to re-derive `visible` from. Centred over a `cdk/overlay`
 * global overlay with focus trap + restore; scales/fades in.
 *
 * Default body content is projected; the footer is an optional `#footer`
 * template slot.
 */
@Component({
  selector: 'lg-dialog',
  imports: [NgStyle, NgTemplateOutlet, LgScaleIn],
  template: `
    <ng-template #panelTpl>
      <div
        role="dialog"
        lgScaleIn
        [attr.aria-modal]="modal() ? 'true' : null"
        [attr.aria-labelledby]="header() ? headerId : null"
        [ngStyle]="style()"
        class="flex max-h-[90vh] max-w-[90vw] flex-col rounded-xl border border-border bg-content text-text shadow-xl"
      >
        @if (header() || closable()) {
          <div class="flex shrink-0 items-center justify-between gap-4 p-5">
            <h2 [id]="headerId" class="text-xl font-semibold text-text">
              {{ header() }}
            </h2>
            @if (closable()) {
              <button
                type="button"
                aria-label="Close"
                class="inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-content-hover hover:text-text"
                (click)="requestClose()"
              >
                <i class="ph ph-x" aria-hidden="true"></i>
              </button>
            }
          </div>
        }
        <div
          class="min-h-0 overflow-auto px-5 pb-5"
          [class.pt-5]="!header() && !closable()"
        >
          <ng-content></ng-content>
        </div>
        @if (footerTemplate(); as tpl) {
          <div class="flex shrink-0 justify-end gap-2 px-5 pb-5">
            <ng-container *ngTemplateOutlet="tpl"></ng-container>
          </div>
        }
      </div>
    </ng-template>
  `
})
export class LgDialog implements OnDestroy {
  readonly visible = input(false, { transform: booleanAttribute });
  readonly header = input<string>();
  readonly modal = input(true, { transform: booleanAttribute });
  readonly dismissableMask = input(false, { transform: booleanAttribute });
  readonly closable = input(true, { transform: booleanAttribute });
  readonly style = input<Record<string, string>>();
  readonly visibleChange = output<boolean>();

  protected readonly footerTemplate =
    contentChild<TemplateRef<unknown>>('footer');
  private readonly panelTpl = viewChild<TemplateRef<unknown>>('panelTpl');

  protected readonly headerId = `lg-dialog-${++nextId}`;

  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly modalOverlay = new ModalOverlay(
    inject(Overlay),
    inject(ConfigurableFocusTrapFactory)
  );

  constructor() {
    effect(() => {
      const open = this.visible();
      const tpl = this.panelTpl();
      if (!tpl) {
        return;
      }
      if (open) {
        this.modalOverlay.open(new TemplatePortal(tpl, this.viewContainerRef), {
          placement: 'center',
          hasBackdrop: this.modal(),
          dismissOnBackdrop: this.modal() && this.dismissableMask(),
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
