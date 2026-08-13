import { OptionSchema } from './option-schema';

/**
 * Why `value` is not acceptable for `schema`, or `null` when it is.
 *
 * Callers reject rather than silently accept: the editor's option setters clamp
 * numbers and strip characters on their own, so an unchecked write would report
 * success while storing something else, and the API refuses to store a document
 * whose option values it had to change.
 */
export function validateOptionValue(
  schema: OptionSchema,
  value: unknown
): string | null {
  switch (schema.kind) {
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'expected a finite number';
      }
      if (value < schema.min || value > schema.max) {
        return `out of range [${schema.min}, ${schema.max}]`;
      }
      return null;

    case 'select-button':
    case 'select-dropdown': {
      const values = schema.values.map((v) => v.value);
      return values.includes(value)
        ? null
        : `not one of ${JSON.stringify(values)}`;
    }

    case 'text': {
      if (typeof value !== 'string') return 'expected a string';
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return `longer than ${schema.maxLength} characters`;
      }
      // A fresh RegExp per test: a shared /g instance carries lastIndex.
      if (
        schema.forbiddenChars &&
        new RegExp(schema.forbiddenChars).test(value)
      ) {
        return `contains forbidden characters (/${schema.forbiddenChars}/)`;
      }
      return null;
    }

    case 'textarea':
      if (typeof value !== 'string') return 'expected a string';
      return value.length > schema.maxLength
        ? `longer than ${schema.maxLength} characters`
        : null;

    case 'memory':
      return typeof value === 'string' ? null : 'expected a base64 blob string';
  }
}
