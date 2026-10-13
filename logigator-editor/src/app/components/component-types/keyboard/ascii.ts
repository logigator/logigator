import { KEYBOARD_DATA_BITS } from '@logigator/core';

/**
 * The readout name of every ASCII code that has no glyph: the C0 controls,
 * space and DEL. Horizontal tab reads `TAB` and space `SP`, the names the
 * keyboard's keys go by; the rest are the standard ASCII abbreviations.
 */
export const ASCII_MNEMONICS: ReadonlyMap<number, string> = new Map([
  [0x00, 'NUL'],
  [0x01, 'SOH'],
  [0x02, 'STX'],
  [0x03, 'ETX'],
  [0x04, 'EOT'],
  [0x05, 'ENQ'],
  [0x06, 'ACK'],
  [0x07, 'BEL'],
  [0x08, 'BS'],
  [0x09, 'TAB'],
  [0x0a, 'LF'],
  [0x0b, 'VT'],
  [0x0c, 'FF'],
  [0x0d, 'CR'],
  [0x0e, 'SO'],
  [0x0f, 'SI'],
  [0x10, 'DLE'],
  [0x11, 'DC1'],
  [0x12, 'DC2'],
  [0x13, 'DC3'],
  [0x14, 'DC4'],
  [0x15, 'NAK'],
  [0x16, 'SYN'],
  [0x17, 'ETB'],
  [0x18, 'CAN'],
  [0x19, 'EM'],
  [0x1a, 'SUB'],
  [0x1b, 'ESC'],
  [0x1c, 'FS'],
  [0x1d, 'GS'],
  [0x1e, 'RS'],
  [0x1f, 'US'],
  [0x20, 'SP'],
  [0x7f, 'DEL']
]);

/**
 * The code on the keyboard's data outputs, `bit(0)` (`D0`) the least
 * significant.
 */
export function codeFromBits(bit: (index: number) => boolean): number {
  let code = 0;
  for (let i = KEYBOARD_DATA_BITS - 1; i >= 0; i--) {
    code = (code << 1) | (bit(i) ? 1 : 0);
  }
  return code;
}

/**
 * What the readout shows for `code`: nothing for `0`, which is no key held, a
 * mnemonic for a code without a glyph, and a printable character as itself.
 */
export function readoutText(code: number): string {
  if (code === 0) {
    return '';
  }
  return ASCII_MNEMONICS.get(code) ?? String.fromCharCode(code);
}
