import { describe, expect, it } from 'vitest';
import { NOT_TRANSLATABLE } from '@logigator/contract';
import {
  resolveTexts,
  type MachineFields,
  type OriginalTexts
} from './document-texts';

const DIGEST = 'a'.repeat(32);
const OLDER_DIGEST = 'b'.repeat(32);

/** An English original whose detection is current for its text. */
function original(overrides: Partial<OriginalTexts> = {}): OriginalTexts {
  return {
    name: 'Full Adder',
    description: 'Adds three bits.',
    textDigest: DIGEST,
    analyzedDigest: DIGEST,
    nameLanguage: 'en',
    descriptionLanguage: 'en',
    ...overrides
  };
}

/** A current German machine row with a text for both fields. */
function machine(overrides: Partial<MachineFields> = {}): MachineFields {
  return { name: true, description: true, ...overrides };
}

describe('resolveTexts', () => {
  it('offers a current machine text for an original in another language', () => {
    const texts = resolveTexts(original(), null, machine(), 'de');

    expect(texts.name).toEqual({
      text: 'Full Adder',
      language: 'en',
      machineTranslation: true
    });
    expect(texts.description.machineTranslation).toBe(true);
    expect(texts.machineTranslation).toBe(true);
  });

  it('shows a human version instead and offers nothing for that field', () => {
    const texts = resolveTexts(
      original(),
      { name: 'Volladdierer', description: null },
      machine(),
      'de'
    );

    expect(texts.name).toEqual({
      text: 'Volladdierer',
      language: 'de',
      machineTranslation: false
    });
    // The field without a human text still resolves on its own.
    expect(texts.description).toEqual({
      text: 'Adds three bits.',
      language: 'en',
      machineTranslation: true
    });
  });

  it('offers nothing once both fields have a human version', () => {
    const texts = resolveTexts(
      original(),
      { name: 'Volladdierer', description: 'Addiert drei Bits.' },
      machine(),
      'de'
    );

    expect(texts.machineTranslation).toBe(false);
  });

  it('never offers for an original in the reader language or with nothing to translate', () => {
    const sameLanguage = resolveTexts(original(), null, machine(), 'en');
    const neutral = resolveTexts(
      original({
        nameLanguage: NOT_TRANSLATABLE,
        descriptionLanguage: NOT_TRANSLATABLE
      }),
      null,
      machine(),
      'de'
    );

    expect(sameLanguage.machineTranslation).toBe(false);
    expect(neutral.machineTranslation).toBe(false);
    expect(neutral.name.language).toBe(NOT_TRANSLATABLE);
  });

  it('never offers a field the translator kept as it is', () => {
    const texts = resolveTexts(
      original(),
      null,
      machine({ name: false }),
      'de'
    );

    expect(texts.name.machineTranslation).toBe(false);
    expect(texts.description.machineTranslation).toBe(true);
  });

  it('reads a detection of an older text as unknown, offering nothing', () => {
    const texts = resolveTexts(
      original({ analyzedDigest: OLDER_DIGEST }),
      null,
      machine(),
      'de'
    );

    expect(texts.name.language).toBeNull();
    expect(texts.description.language).toBeNull();
    expect(texts.machineTranslation).toBe(false);
  });
});
