import { KEYBOARD_DATA_BITS, KEYBOARD_STROBE_OUTPUT } from '@logigator/core';
import type { InputFrame, SlotWrite } from '../../component-inspection';

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

/** The most characters one paste or one "Type text" send carries. */
export const KEYBOARD_TEXT_LIMIT = 10_000;

/** The keys without a printable character that send a code, by `key`. */
const CONTROL_KEY_CODES: ReadonlyMap<string, number> = new Map([
  ['Enter', 0x0a],
  ['Backspace', 0x08],
  ['Tab', 0x09],
  ['Escape', 0x1b],
  ['Delete', 0x7f]
]);

const PRINTABLE_FIRST = 0x20;
const PRINTABLE_LAST = 0x7e;
const LINE_FEED = 0x0a;
const HORIZONTAL_TAB = 0x09;
const CARRIAGE_RETURN = 0x0d;

/**
 * What a key sends, by its `KeyboardEvent.key`: an ASCII `code`, or a
 * character outside ASCII that is `skipped`.
 */
export type KeyCharacter =
  | { readonly kind: 'ascii'; readonly code: number }
  | { readonly kind: 'skipped'; readonly char: string };

/**
 * The character a key sends: one of the control keys Enter (LF), Backspace,
 * Tab, Escape and Delete, or a `key` that is a single printable character.
 * A single character outside ASCII is `skipped`. `null` for every other key
 * — arrows, F-keys, modifiers, a lone control character — which sends
 * nothing and is not the keyboard's to handle.
 */
export function characterOfKey(key: string): KeyCharacter | null {
  const control = CONTROL_KEY_CODES.get(key);
  if (control !== undefined) {
    return { kind: 'ascii', code: control };
  }
  const point = key.codePointAt(0);
  if (point === undefined || String.fromCodePoint(point) !== key) {
    return null;
  }
  if (isPrintable(point)) {
    return { kind: 'ascii', code: point };
  }
  return point > 0x7f ? { kind: 'skipped', char: key } : null;
}

/** The control keys' codes, each of which a text carries as its character. */
const CONTROL_CODES: ReadonlySet<number> = new Set(CONTROL_KEY_CODES.values());

/** The control codes a paste sends; the rest a paste drops. */
const PASTED_CONTROL_CODES: ReadonlySet<number> = new Set([
  HORIZONTAL_TAB,
  LINE_FEED
]);

function isPrintable(point: number): boolean {
  return point >= PRINTABLE_FIRST && point <= PRINTABLE_LAST;
}

/**
 * The characters of `text` by code point, with CRLF and a lone CR read as
 * one LF at the CR's index; `index` is the UTF-16 index in `text`.
 */
function* textCharacters(
  text: string
): Generator<{ readonly char: string; readonly index: number }> {
  let index = 0;
  while (index < text.length) {
    const point = text.codePointAt(index)!;
    const char = String.fromCodePoint(point);
    if (point === CARRIAGE_RETURN) {
      yield { char: '\n', index };
      index += text[index + 1] === '\n' ? 2 : 1;
      continue;
    }
    yield { char, index };
    index += char.length;
  }
}

/** Text turned into the codes the keyboard sends for it. */
export interface KeyboardText {
  /** The codes, in order; never `0`. */
  readonly codes: readonly number[];
  /** Every character outside ASCII, in order, each left out of `codes`. */
  readonly skipped: readonly string[];
  /** Whether characters past `limit` codes were left out. */
  readonly truncated: boolean;
}

/**
 * The codes `text` sends, as a paste does: CRLF and a lone CR become LF, tab
 * and LF are sent, printable ASCII is sent as itself, a character outside
 * ASCII is skipped and listed, and every other control character is dropped.
 * Stops after `limit` codes.
 */
export function textToCodes(
  text: string,
  limit = KEYBOARD_TEXT_LIMIT
): KeyboardText {
  const codes: number[] = [];
  const skipped: string[] = [];
  let truncated = false;
  for (const { char } of textCharacters(text)) {
    const point = char.codePointAt(0)!;
    if (isPrintable(point) || PASTED_CONTROL_CODES.has(point)) {
      if (codes.length === limit) {
        truncated = true;
        break;
      }
      codes.push(point);
    } else if (point > 0x7f) {
      skipped.push(char);
    }
  }
  return { codes, skipped, truncated };
}

/**
 * Text read strictly: its `codes`, or the first character the keyboard has no
 * key for, at its UTF-16 `index` in the text.
 */
export type StrictKeyboardText =
  | { readonly kind: 'codes'; readonly codes: readonly number[] }
  | {
      readonly kind: 'unsendable';
      readonly char: string;
      readonly index: number;
    };

/**
 * The codes `text` sends with nothing left out: printable ASCII and the codes
 * of the control keys (LF, tab, backspace, escape, delete) as themselves,
 * CRLF and a lone CR as LF. Any other character makes the whole text
 * `unsendable`.
 */
export function textToCodesStrict(text: string): StrictKeyboardText {
  const codes: number[] = [];
  for (const { char, index } of textCharacters(text)) {
    const point = char.codePointAt(0)!;
    if (!isPrintable(point) && !CONTROL_CODES.has(point)) {
      return { kind: 'unsendable', char, index };
    }
    codes.push(point);
  }
  return { kind: 'codes', codes };
}

/** The seven data slots, each set to its bit of `code`. */
function dataWrites(code: number): SlotWrite[] {
  const writes: SlotWrite[] = [];
  for (let bit = 0; bit < KEYBOARD_DATA_BITS; bit++) {
    writes.push({
      slot: bit,
      drive: 'level',
      value: ((code >> bit) & 1) === 1
    });
  }
  return writes;
}

/**
 * A key going down: `D` takes `code` and `STB` pulses, on one tick. Counted,
 * so the window can say how much is still to go out. A code outside
 * `1`…`0x7F` is refused: `0` on `D` means no key is held.
 */
export function pressFrame(code: number): InputFrame {
  if (!Number.isInteger(code) || code < 1 || code > 0x7f) {
    throw new RangeError(`Not a code the keyboard sends: ${code}`);
  }
  return {
    kind: 'event',
    counted: true,
    writes: [
      ...dataWrites(code),
      { slot: KEYBOARD_STROBE_OUTPUT, drive: 'pulse', value: true }
    ]
  };
}

/** The key on `D` going up: every data slot low. */
export function releaseFrame(): InputFrame {
  return { kind: 'event', writes: dataWrites(0) };
}

/** Each code pressed and released, in order. */
export function tapFrames(codes: readonly number[]): InputFrame[] {
  return codes.flatMap((code) => [pressFrame(code), releaseFrame()]);
}

/**
 * Every data slot low at once, as a `state` frame: what a cancel applies
 * after dropping the frames still queued.
 */
export function resetFrame(): InputFrame {
  return { kind: 'state', writes: dataWrites(0) };
}
