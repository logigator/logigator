import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  signal,
  Type,
  ViewContainerRef,
  viewChild
} from '@angular/core';
import { afterPaint } from '../../internal/after-paint';
import { DialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';

/** The component class {@link DialogService} renders inside the container. */
export const DIALOG_CHILD_COMPONENT = new InjectionToken<Type<unknown>>(
  'lg-dialog-child-component'
);

let nextId = 0;

/**
 * The chrome rendered inside a {@link DialogService}-opened overlay: a centred
 * card (mirroring {@link LgDialog}'s look) with an optional header + close
 * button, hosting the dynamically-created child component.
 *
 * The child is created in `ngAfterViewInit` — after `open()` has returned and
 * the caller has subscribed to `onChildComponentLoaded` — and its `inputValues`
 * are applied via `setInput()` **before** the child's first change detection, so
 * `input.required` signals resolve. The real instance is then reported through
 * the ref. The scale/fade-in plays after a double rAF, like {@link LgDialog}.
 */
@Component({
  selector: 'lg-dynamic-dialog-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle],
  template: `
    <div
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="config.header ? headerId : null"
      [ngStyle]="panelStyle()"
      [class]="panelClasses()"
    >
      @if (config.header || config.closable !== false) {
        <div
          class="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4"
        >
          <h2 [id]="headerId" class="text-lg font-semibold text-text">
            {{ config.header }}
          </h2>
          @if (config.closable !== false) {
            <button
              type="button"
              aria-label="Close"
              class="inline-flex size-8 items-center justify-center rounded text-muted transition-colors hover:bg-content-hover hover:text-text"
              (click)="ref.close()"
            >
              <i class="ph ph-x" aria-hidden="true"></i>
            </button>
          }
        </div>
      }
      <div class="min-h-0 overflow-auto p-5">
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
  private readonly shown = signal(false);

  protected readonly panelStyle = computed<Record<string, string>>(() => ({
    ...(this.config.width ? { width: this.config.width } : {}),
    ...(this.config.style ?? {})
  }));

  protected readonly panelClasses = computed(() =>
    [
      'flex max-h-[90vh] max-w-[90vw] flex-col rounded-xl border border-border bg-content text-text shadow-xl',
      'transition duration-200 ease-out',
      this.shown() ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
    ].join(' ')
  );

  ngAfterViewInit(): void {
    const componentRef = this.childHost().createComponent(this.component);
    const inputs = this.config.inputValues;
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        componentRef.setInput(key, value);
      }
    }
    this.ref.notifyChildLoaded(componentRef.instance);

    // Paint the scaled-down "from" state first, so the scale/fade-in runs.
    afterPaint(() => this.shown.set(true));
  }
}
