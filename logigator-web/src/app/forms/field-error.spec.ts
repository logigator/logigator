import { beforeEach, describe, expect, it } from 'vitest';
import { provideZonelessChangeDetection, Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  emailSchema,
  passwordSchema,
  usernameSchema
} from '@logigator/contract';
import { fieldError, passwordsMatch, setServerError } from './field-error';
import { zodValidator } from './zod-validator';
import { TranslationKey } from '../translation/translation-key.model';

function makeForm() {
  return new FormGroup(
    {
      username: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, zodValidator(usernameSchema)]
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, zodValidator(emailSchema)]
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, zodValidator(passwordSchema)]
      }),
      passwordRepeat: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required]
      })
    },
    { validators: passwordsMatch('password', 'passwordRepeat') }
  );
}

describe('fieldError', () => {
  let form: ReturnType<typeof makeForm>;
  let errors: Record<string, Signal<TranslationKey | null>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection()]
    });
    form = makeForm();
    TestBed.runInInjectionContext(() => {
      errors = {
        username: fieldError(form.controls.username, 'username'),
        email: fieldError(form.controls.email, 'email'),
        password: fieldError(form.controls.password, 'password'),
        passwordRepeat: fieldError(
          form.controls.passwordRepeat,
          'passwordRepeat'
        )
      };
    });
  });

  it('says nothing until the field has been touched', () => {
    form.controls.email.setValue('nonsense');
    expect(errors['email']()).toBeNull();

    form.controls.email.markAsTouched();
    expect(errors['email']()).toBe('forms.errors.emailInvalid');
  });

  it('reports emptiness as required rather than as a broken rule', () => {
    form.markAllAsTouched();
    expect(errors['email']()).toBe('forms.errors.required');
    expect(errors['password']()).toBe('forms.errors.required');
  });

  it('tells a schema rule apart by the issue it raised', () => {
    form.markAllAsTouched();

    form.controls.username.setValue('a');
    expect(errors['username']()).toBe('forms.errors.usernameTooShort');
    form.controls.username.setValue('a b');
    expect(errors['username']()).toBe('forms.errors.usernamePattern');
    form.controls.username.setValue('x'.repeat(21));
    expect(errors['username']()).toBe('forms.errors.usernameTooLong');

    form.controls.password.setValue('short1');
    expect(errors['password']()).toBe('forms.errors.passwordTooShort');
    form.controls.password.setValue('lettersonly');
    expect(errors['password']()).toBe('forms.errors.passwordComplexity');
  });

  it('re-decides the repeat field when the first password is the one edited', () => {
    form.markAllAsTouched();
    form.controls.password.setValue('correct1horse');
    form.controls.passwordRepeat.setValue('correct1horse');
    expect(errors['passwordRepeat']()).toBeNull();

    // The edit is on the *other* control; a field-level check would not notice.
    form.controls.password.setValue('correct1horse2');
    expect(errors['passwordRepeat']()).toBe('forms.errors.passwordMismatch');
  });

  it('drops a message only the server could produce as soon as the value changes', () => {
    form.markAllAsTouched();
    form.controls.email.setValue('taken@example.com');
    setServerError(form.controls.email, 'pages.register.emailTaken');
    expect(errors['email']()).toBe('pages.register.emailTaken');

    form.controls.email.setValue('free@example.com');
    expect(errors['email']()).toBeNull();
  });
});
