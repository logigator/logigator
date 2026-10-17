import { describe, expect, it } from 'vitest';
import {
  KEYBOARD_DATA_BITS,
  KEYBOARD_GLYPH_COLUMN_WIDTH,
  KEYBOARD_KEY_DOWN_OUTPUT,
  KEYBOARD_STROBE_OUTPUT,
  keyboardMeta
} from './keyboard.meta';

describe('keyboardMeta', () => {
  it('puts the data bits first, least significant first, then the strobe and key down', () => {
    const { inputs, outputs } = keyboardMeta.ports();
    const labels = keyboardMeta.labels().outputs;
    expect(inputs).toBe(0);
    expect(outputs).toBe(KEYBOARD_DATA_BITS + 2);
    expect(labels.slice(0, KEYBOARD_DATA_BITS)).toEqual(
      Array.from({ length: KEYBOARD_DATA_BITS }, (_, bit) => `D${bit}`)
    );
    expect(labels[KEYBOARD_STROBE_OUTPUT]).toBe('STB');
    expect(labels[KEYBOARD_KEY_DOWN_OUTPUT]).toBe('KD');
    expect(labels).toHaveLength(outputs);
  });

  it('is a glyph column and a one-cell label column wide, one row per output', () => {
    expect(keyboardMeta.body()).toEqual({
      width: KEYBOARD_GLYPH_COLUMN_WIDTH + 1,
      height: 9
    });
  });
});
