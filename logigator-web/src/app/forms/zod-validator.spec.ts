import { describe, expect, it } from 'vitest';
import { FormControl } from '@angular/forms';
import { socialUrlSchema, usernameSchema } from '@logigator/contract';
import { zodValidator } from './zod-validator';

describe('zodValidator', () => {
  it('reads whitespace in an optional field as the field left empty', () => {
    const control = new FormControl('   ', {
      validators: [zodValidator(socialUrlSchema, { optional: true })]
    });

    expect(control.errors).toBeNull();
  });

  it('still checks what an optional field holds beside the whitespace', () => {
    const control = new FormControl('  not a link ', {
      validators: [zodValidator(socialUrlSchema, { optional: true })]
    });

    expect(control.errors).not.toBeNull();
  });

  it('runs the schema over whitespace in a field that is not optional', () => {
    // `Validators.required` passes `'  '`, so the schema is what refuses it.
    const control = new FormControl('  ', {
      validators: [zodValidator(usernameSchema)]
    });

    expect(control.errors).not.toBeNull();
  });
});
