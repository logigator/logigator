import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  computed,
  inject,
  InjectionToken,
  isSignal,
  Type,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { LgScaleIn } from '../../internal/fade-in';
import { lgLabel } from '../../tokens/labels';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';

/** The component class {@link DialogService} renders inside the container. */
export const DIALOG_CHILD_COMPONENT = new InjectionToken<Type<unknown>>(
  'lg-dialog-child-component'
);

let nextId = 0;

/**
 * The chrome rendered inside a {@link DialogService}-opened overlay: a centred
 * card (mirroring {@link LgDialog}'s look) — or, with
 * {@link DialogConfig.fullscreen}, a viewport-filling takeover — with an
 * optional header + close button, hosting the dynamically-created child
 * component.
 *
 * The child is created in `ngAfterViewInit` — after `open()` has returned and
 * the caller has subscribed to `onChildComponentLoaded` — and its `inputValues`
 * are applied via `setInput()` **before** the child's first change detection, so
 * `input.required` signals resolve. The real instance is then reported through
 * the ref. The panel scales/fades in, like {@link LgDialog}.
 */
@Component({
  selector: 'lg-dynamic-dialog-container',
  imports: [NgStyle, LgScaleIn],
  template: `
    <div
      role="dialog"
      aria-modal="true"
      lgScaleIn
      [attr.aria-labelledby]="config.header ? headerId : null"
      [ngStyle]="panelStyle()"
      class="flex flex-col bg-content text-text"
      [class]="panelClass()"
    >
      @if (config.header || config.closable !== false) {
        <div class="flex shrink-0 items-center justify-between gap-4 p-5">
          <h2 [id]="headerId" class="text-xl font-semibold text-text">
            {{ config.header }}
          </h2>
          @if (config.closable !== false) {
            <button
              type="button"
              [attr.aria-label]="closeLabel"
              class="inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-content-hover hover:text-text"
              (click)="ref.close()"
            >
              <i class="ph ph-x" aria-hidden="true"></i>
            </button>
          }
        </div>
      }
      <div [class]="bodyClass()">
        <ng-container #childHost></ng-container>
      </div>
    </div>
  `
})
export class LgDynamicDialogContainer implements AfterViewInit {
  protected readonly ref = inject(DialogRef);
  protected readonly config = inject(DialogConfig);
  private readonly component = inject(DIALOG_CHILD_COMPONENT);
  private readonly childHost = viewChild.required('childHost', {
    read: ViewContainerRef
  });

  protected readonly headerId = `lg-dynamic-dialog-${++nextId}`;

  /** Per-dialog override first, then the app-wide `LG_LABELS` string. */
  protected readonly closeLabel = this.config.closeLabel ?? lgLabel('close');

  protected readonly fullscreen = computed(() => {
    const fullscreen = this.config.fullscreen;
    return isSignal(fullscreen) ? fullscreen() : (fullscreen ?? false);
  });

  protected readonly panelClass = computed(() =>
    this.fullscreen()
      ? 'h-dvh w-screen'
      : 'max-h-[90vh] max-w-[90vw] rounded-xl border border-border shadow-xl'
  );

  protected readonly panelStyle = computed<Record<string, string>>(() =>
    this.fullscreen()
      ? {}
      : {
          ...(this.config.width ? { width: this.config.width } : {}),
          ...(this.config.style ?? {})
        }
  );

  protected readonly bodyClass = computed(() => {
    const defaultBody =
      this.config.header || this.config.closable !== false
        ? 'overflow-auto px-5 pb-5'
        : 'overflow-auto p-5';
    return `min-h-0 grow ${this.config.bodyClass ?? defaultBody}`;
  });

  ngAfterViewInit(): void {
    const componentRef = this.childHost().createComponent(this.component);
    const inputs = this.config.inputValues;
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        componentRef.setInput(key, value);
      }
    }
    this.ref.notifyChildLoaded(componentRef.instance);
  }
}
