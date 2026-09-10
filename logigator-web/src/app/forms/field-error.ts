import { computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn
} from '@angular/forms';
import { TranslationKey } from '../translation/translation-key.model';

/**
 * Which rules a field carries, and so which message a failure gets. The kind is
 * named at the call site rather than inferred from the control name: the same
 * rules appear under different names across the forms, and a renamed control
 * must not silently lose its messages.
 */
export type FormFieldKind =
  'email' | 'username' | 'password' | 'passwordRepeat';

/** Error key a group carrying {@link passwordsMatch} sets when they differ. */
const PASSWORD_MISMATCH = 'passwordMismatch';

/** Error key {@link setServerError} parks a translation key under. */
const SERVER = 'server';

/**
 * The two password fields of a form must agree.
 *
 * A group validator rather than one on the repeat field: a field-level check
 * would read its sibling without depending on it, so editing the *first*
 * password would leave the verdict on the second one behind.
 */
export function passwordsMatch(
  passwordKey: string,
  repeatKey: string
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value as string | undefined;
    const repeat = group.get(repeatKey)?.value as string | undefined;
    // Nothing to compare against yet; `required` owns the empty field.
    if (!password || !repeat) return null;
    return password === repeat ? null : { [PASSWORD_MISMATCH]: true };
  };
}

/**
 * Puts a message the API produced on the field it is about — a taken address,
 * say, belongs beside the address rather than above the form.
 *
 * Set outside the validator chain on purpose: the next edit re-runs the
 * validators and drops it, which is exactly right for a verdict only the server
 * can reach, and stops the message outliving the value it was about.
 */
export function setServerError(
  control: AbstractControl,
  key: TranslationKey
): void {
  control.setErrors({ [SERVER]: key });
  control.markAsTouched();
}

/**
 * Marks every field the API named in a `validation_failed` body. Reaching this
 * means the client's copy of the schemas and the server's disagree, so the
 * fields get a generic message rather than the server's own — those strings are
 * English, and a body keyed by a field this form does not have is left to the
 * caller's form-level message.
 */
export function applyServerFieldErrors(
  form: FormGroup,
  details: Record<string, string[]> | undefined
): void {
  for (const field of Object.keys(details ?? {})) {
    const control = form.get(field);
    if (control) setServerError(control, 'forms.errors.invalid');
  }
}

/**
 * The message a field is currently failing with, or `null` while it has none to
 * show. Nothing appears before the field is touched, and a submit touches every
 * field, so a form that is wrong on arrival stays quiet until the visitor has
 * had a turn.
 *
 * Driven by the *root* form's events rather than the control's own: a value
 * change propagates upward, so the root sees every edit in the form, including
 * the sibling a cross-field rule compares against.
 */
export function fieldError(
  control: AbstractControl,
  kind: FormFieldKind
): Signal<TranslationKey | null> {
  const changes = toSignal(control.root.events, { initialValue: null });
  return computed(() => {
    changes();
    if (!control.touched) return null;
    return errorKeyFor(kind, control.errors, control.parent?.errors ?? null);
  });
}

function errorKeyFor(
  kind: FormFieldKind,
  errors: ValidationErrors | null,
  groupErrors: ValidationErrors | null
): TranslationKey | null {
  if (errors?.[SERVER]) return errors[SERVER] as TranslationKey;
  if (errors?.['required']) return 'forms.errors.required';

  const codes = (errors?.['zod'] as string[] | undefined) ?? [];
  if (codes.length) return zodMessage(kind, codes);

  if (kind === 'passwordRepeat' && groupErrors?.[PASSWORD_MISMATCH]) {
    return 'forms.errors.passwordMismatch';
  }
  return null;
}

/**
 * One message per field per failing rule. The two password patterns — a letter
 * and a digit — both arrive as `invalid_format` and share one message, which is
 * how the requirement reads anyway.
 */
function zodMessage(kind: FormFieldKind, codes: string[]): TranslationKey {
  const tooSmall = codes.includes('too_small');
  const tooBig = codes.includes('too_big');
  switch (kind) {
    case 'email':
      return 'forms.errors.emailInvalid';
    case 'username':
      if (tooSmall) return 'forms.errors.usernameTooShort';
      if (tooBig) return 'forms.errors.usernameTooLong';
      return 'forms.errors.usernamePattern';
    default:
      if (tooSmall) return 'forms.errors.passwordTooShort';
      if (tooBig) return 'forms.errors.passwordTooLong';
      return 'forms.errors.passwordComplexity';
  }
}
