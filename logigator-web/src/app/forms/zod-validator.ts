import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type * as z from 'zod';

/**
 * Validates a control against a schema from `@logigator/contract`, so a field's
 * rules are the ones the API enforces rather than a second copy that can drift
 * from them.
 *
 * The issue *codes* are what lands in `ValidationErrors`, never zod's message
 * text: those messages are English, and this site answers in four languages.
 * `fieldErrorKey` turns a code into a translation key.
 */
export function zodValidator(schema: z.ZodType): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: unknown = control.value;
    // An empty field is `Validators.required`'s to report. Running the schema
    // over it too would answer "not a valid address" to somebody who has not
    // typed anything yet.
    if (value === null || value === undefined || value === '') return null;

    const result = schema.safeParse(value);
    return result.success
      ? null
      : { zod: result.error.issues.map((issue) => issue.code) };
  };
}
