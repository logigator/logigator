import { KEYBOARD_DATA_BITS, KEYBOARD_STROBE_OUTPUT } from '@logigator/core';
import { INPUT_QUEUE_LIMIT, type InputFrame } from '../../component-inspection';

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

/**
 * Ticks each of a press's three frames holds: `D` takes the code a tick
 * before `STB` rises, `STB` is high for one, and `D` keeps the code for a
 * tick after it falls. A circuit sees every character on `D` for at least
 * three ticks and its strobe for exactly one, with a tick of setup before
 * the strobe's rising edge and a tick of hold after it, so a latch still
 * reads every code when its data path has one gate more than its strobe
 * path, or its strobe path one more than its data path.
 */
const PRESS_FRAME_TICKS = 1;

/**
 * Ticks `D` stays zero after a release, or a cancel, before the next key's
 * code may replace it, so a double letter still reads as two presses.
 */
const RELEASE_TICKS = 1;

/**
 * The event frames one key press is: what turns the route's pending count
 * into characters. A release and a reset are states, so neither counts.
 */
const PRESS_EVENTS = 3;

/**
 * The keyboard's eight outputs for `code` on `D`, the strobe as `strobe`
 * says: `D0` the least significant bit, `STB` last.
 */
function outputs(code: number, strobe: boolean | null): (boolean | null)[] {
  const state: (boolean | null)[] = [];
  for (let bit = 0; bit < KEYBOARD_DATA_BITS; bit++) {
    state.push(((code >> bit) & 1) === 1);
  }
  state[KEYBOARD_STROBE_OUTPUT] = strobe;
  return state;
}

/**
 * A key going down, as three events: `D` takes `code` with `STB` low, `STB`
 * rises, and `STB` falls while `D` keeps the code. The engine has no pulse
 * of its own, so the third frame is what ends the strobe. A code outside
 * `1`…`0x7F` is refused: `0` on `D` means no key is held.
 */
export function pressFrames(code: number): InputFrame[] {
  if (!Number.isInteger(code) || code < 1 || code > 0x7f) {
    throw new RangeError(`Not a code the keyboard sends: ${code}`);
  }
  return [
    { state: outputs(code, false), hold: PRESS_FRAME_TICKS },
    { state: outputs(code, true), hold: PRESS_FRAME_TICKS },
    { state: outputs(code, false), hold: PRESS_FRAME_TICKS }
  ];
}

/**
 * The key on `D` going up: every data bit low, held for
 * {@link RELEASE_TICKS}. A state rather than an event, so it stays out of the
 * pending count; it never merges, since it always follows a press.
 */
export function releaseFrame(): InputFrame {
  return {
    state: outputs(0, null),
    hold: RELEASE_TICKS,
    coalesce: true
  };
}

/** Each code pressed and released, in order: four ticks a character. */
export function tapFrames(codes: readonly number[]): InputFrame[] {
  return codes.flatMap((code) => [...pressFrames(code), releaseFrame()]);
}

/**
 * Every output low, the strobe included, since the cancel it follows can cut
 * a press short while `STB` is high. Held as long as a release: the cancel
 * ends whatever hold was running, so the reset is on the outputs after the
 * next tick, and the next character's first frame replaces it no sooner
 * than a tick later. `D` is zero for that tick, as between two characters,
 * and `STB`, which the next press raises only with its second frame, stays
 * low for at least two.
 */
export function resetFrame(): InputFrame {
  return {
    state: outputs(0, false),
    hold: RELEASE_TICKS,
    coalesce: true
  };
}

/**
 * How many characters are queued and not yet on `D`, from how many event
 * frames the keyboard's input has not yet applied: a character whose first
 * press frame is applied is on `D` already, so the count rounds down.
 */
export function pendingCharacters(pendingEvents: number): number {
  return Math.floor(pendingEvents / PRESS_EVENTS);
}

/**
 * How many more characters fit behind `pendingEvents` event frames, as taps
 * or as presses: the most a paste, a send or a key may carry right now, the
 * input holding at most {@link INPUT_QUEUE_LIMIT} event frames.
 */
export function charactersThatFit(pendingEvents: number): number {
  return Math.max(
    0,
    Math.floor((INPUT_QUEUE_LIMIT - pendingEvents) / PRESS_EVENTS)
  );
}
