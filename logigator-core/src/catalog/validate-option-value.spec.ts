import { describe, expect, it } from 'vitest';
import { validateOptionValue } from './validate-option-value';
import { OptionSchema } from './option-schema';

describe('validateOptionValue', () => {
  const number: OptionSchema = {
    kind: 'number',
    label: 'l',
    min: 2,
    max: 8,
    default: 2
  };

  it('accepts the bounds and rejects outside them', () => {
    expect(validateOptionValue(number, 2)).toBeNull();
    expect(validateOptionValue(number, 8)).toBeNull();
    expect(validateOptionValue(number, 1)).toMatch('out of range');
    expect(validateOptionValue(number, 9)).toMatch('out of range');
  });

  it('rejects non-finite numbers rather than storing them', () => {
    expect(validateOptionValue(number, Number.NaN)).toMatch('finite');
    expect(validateOptionValue(number, Number.POSITIVE_INFINITY)).toMatch(
      'finite'
    );
    expect(validateOptionValue(number, '4')).toMatch('finite');
  });

  it('accepts only listed select values, both kinds', () => {
    const values = [{ value: 4 }, { value: 8 }];
    for (const kind of ['select-button', 'select-dropdown'] as const) {
      const schema = { kind, label: 'l', values, default: 4 } as OptionSchema;
      expect(validateOptionValue(schema, 8)).toBeNull();
      expect(validateOptionValue(schema, 6)).toMatch('not one of');
      // The values are matched by identity, so a lookalike string is not one.
      expect(validateOptionValue(schema, '8')).toMatch('not one of');
    }
  });

  it('enforces a text option´s length and forbidden characters', () => {
    const schema: OptionSchema = {
      kind: 'text',
      label: 'l',
      maxLength: 5,
      forbiddenChars: ',',
      default: ''
    };
    expect(validateOptionValue(schema, 'abcde')).toBeNull();
    expect(validateOptionValue(schema, 'abcdef')).toMatch('longer than 5');
    expect(validateOptionValue(schema, 'a,b')).toMatch('forbidden');
  });

  it('tests each value against a fresh regexp', () => {
    const schema: OptionSchema = {
      kind: 'text',
      label: 'l',
      forbiddenChars: ',',
      default: ''
    };
    // A shared /g instance would carry lastIndex and pass the second call.
    expect(validateOptionValue(schema, 'a,')).toMatch('forbidden');
    expect(validateOptionValue(schema, 'a,')).toMatch('forbidden');
  });
});
