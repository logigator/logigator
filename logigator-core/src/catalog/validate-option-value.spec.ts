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

  it('rejects a fraction that is otherwise in range', () => {
    // In bounds and finite, so only the integer rule refuses it — the option
    // setters round, and accepting it would report success while storing 5.
    expect(validateOptionValue(number, 4.5)).toMatch('integer');
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

  describe('name-map', () => {
    const schema: OptionSchema = {
      kind: 'name-map',
      label: 'l',
      keys: ['a', 'b', 'c'],
      maxLength: 4,
      forbiddenChars: ',',
      default: {}
    };

    it('accepts no names, some names and an empty name', () => {
      expect(validateOptionValue(schema, {})).toBeNull();
      expect(validateOptionValue(schema, { b: 'Fire' })).toBeNull();
      expect(validateOptionValue(schema, { a: 'Jump', c: '' })).toBeNull();
    });

    it('refuses anything but a plain object', () => {
      for (const value of [null, undefined, 'a', 3, ['Jump'], []]) {
        expect(validateOptionValue(schema, value)).toMatch(
          'expected an object'
        );
      }
    });

    it('refuses a key outside the schema´s keys', () => {
      expect(validateOptionValue(schema, { a: 'Jump', d: 'X' })).toMatch(
        'unknown key "d"'
      );
    });

    it('refuses a name that is not a string', () => {
      expect(validateOptionValue(schema, { a: 1 })).toMatch(
        '"a": expected a string'
      );
      expect(validateOptionValue(schema, { a: null })).toMatch(
        '"a": expected a string'
      );
    });

    it('refuses a name over the length cap', () => {
      expect(validateOptionValue(schema, { b: 'abcd' })).toBeNull();
      expect(validateOptionValue(schema, { b: 'abcde' })).toMatch(
        '"b": longer than 4'
      );
    });

    it('refuses a forbidden character on every test', () => {
      // A shared /g instance would carry lastIndex and pass the second call.
      expect(validateOptionValue(schema, { c: 'a,' })).toMatch('forbidden');
      expect(validateOptionValue(schema, { c: 'a,' })).toMatch('forbidden');
    });
  });
});
