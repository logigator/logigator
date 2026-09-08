import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input
} from '@angular/core';

/**
 * Label, hint and error scaffolding around one form control. The control itself
 * is projected, so the field skins nothing and stays usable with a native
 * `input`, an `lgInputText`, a `lg-select` or anything else.
 *
 * Strings are the consumer's, translated: the library carries none of its own.
 * `error` replaces `hint` while it is set — a field showing both makes the
 * reader work out which one still applies.
 *
 * `aria-describedby` is a binding on the projected control rather than
 * something this component reaches in and writes, so it is part of the server's
 * first byte:
 *
 * ```html
 * <lg-form-field #field="lgFormField" inputId="email" [label]="…" [error]="…">
 *   <input lgInputText id="email" [attr.aria-describedby]="field.describedBy()" />
 * </lg-form-field>
 * ```
 */
@Component({
  selector: 'lg-form-field',
  exportAs: 'lgFormField',
  host: { class: 'flex flex-col gap-1.5' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <label class="text-sm font-medium text-text" [attr.for]="inputId()">
        {{ label() }}
        @if (required()) {
          <span class="text-error" aria-hidden="true">*</span>
        }
      </label>
    }

    <ng-content />

    @if (error()) {
      <!-- role=alert so a message that appears after a failed submit is
           announced without moving focus off the control being fixed. -->
      <p class="text-sm text-error" role="alert" [attr.id]="messageId()">
        {{ error() }}
      </p>
    } @else if (hint()) {
      <p class="text-sm text-muted" [attr.id]="messageId()">{{ hint() }}</p>
    }
  `
})
export class LgFormField {
  /** `id` of the projected control; ties the label and the message to it. */
  readonly inputId = input<string>();
  readonly label = input<string>();
  /** Shown while there is no error. */
  readonly hint = input<string>();
  /** The message to show instead of the hint; its presence is the invalid state. */
  readonly error = input<string>();
  readonly required = input(false, { transform: booleanAttribute });

  /** Id of the message element, or `undefined` while there is none to name. */
  readonly describedBy = computed(() =>
    this.error() || this.hint() ? this.messageId() : undefined
  );

  protected readonly messageId = computed(() => {
    const id = this.inputId();
    return id ? `${id}-message` : undefined;
  });
}
