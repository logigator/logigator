import {
  KEYBOARD_DATA_BITS,
  KEYBOARD_KEY_DOWN_OUTPUT,
  KEYBOARD_STROBE_OUTPUT
} from '@logigator/core';
import { INPUT_QUEUE_LIMIT, type InputFrame } from '../../component-inspection';

/**
 * The readout name of every code the keyboard sends that has no glyph of its
 * own: the C0 controls, space, DEL, no-break space and soft hyphen. Horizontal
 * tab reads `TAB` and space `SP`, the names the keys go by, the arrow keys'
 * codes are spelled as the gamepad spells its D-pad and Home's reads `HOM`;
 * the rest are the standard abbreviations.
 */
export const KEYBOARD_MNEMONICS: ReadonlyMap<number, string> = new Map([
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
  [0x0b, 'HOM'],
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
  [0x1c, 'RT'],
  [0x1d, 'LT'],
  [0x1e, 'UP'],
  [0x1f, 'DN'],
  [0x20, 'SP'],
  [0x7f, 'DEL'],
  [0xa0, 'NBS'],
  [0xad, 'SHY']
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
 * What the readout shows for `code`: nothing for `0`, which no key sends, a
 * mnemonic for a code without a glyph, and a printable character as itself.
 */
export function readoutText(code: number): string {
  if (code === 0) {
    return '';
  }
  return KEYBOARD_MNEMONICS.get(code) ?? String.fromCharCode(code);
}

/** The most codes one paste or one "Type text" send carries. */
export const KEYBOARD_TEXT_LIMIT = 10_000;

/** The keys without a printable character that send a code, by `key`. */
const CONTROL_KEY_CODES: ReadonlyMap<string, number> = new Map([
  ['Enter', 0x0a],
  ['Backspace', 0x08],
  ['Tab', 0x09],
  ['Escape', 0x1b],
  ['Delete', 0x7f],
  ['ArrowRight', 0x1c],
  ['ArrowLeft', 0x1d],
  ['ArrowUp', 0x1e],
  ['ArrowDown', 0x1f],
  ['Home', 0x0b]
]);

/** Typographic punctuation, sent as the ASCII it stands in for. */
const FOLDED_CHARACTERS: ReadonlyMap<string, string> = new Map([
  ['\u2018', "'"],
  ['\u2019', "'"],
  ['\u201a', "'"],
  ['\u201b', "'"],
  ['\u201c', '"'],
  ['\u201d', '"'],
  ['\u201e', '"'],
  ['\u201f', '"'],
  ['\u2012', '-'],
  ['\u2013', '-'],
  ['\u2014', '-'],
  ['\u2015', '-'],
  ['\u2026', '...']
]);

const LINE_FEED = 0x0a;
const HORIZONTAL_TAB = 0x09;
const CARRIAGE_RETURN = 0x0d;

/**
 * What a key sends, by its `KeyboardEvent.key`: its `codes`, one for every
 * key but a folded one (`…` is three), or a character outside Latin-1 that
 * is `skipped`.
 */
export type KeyCharacter =
  | { readonly kind: 'codes'; readonly codes: readonly number[] }
  | { readonly kind: 'skipped'; readonly char: string };

/**
 * The character a key sends: one of the control keys Enter (LF), Backspace,
 * Tab, Escape, Delete, the arrows and Home, or a `key` that is a single
 * printable character. A single character neither Latin-1 nor folded is
 * `skipped`. `null` for every other key (F-keys, modifiers, a lone control
 * character), which sends nothing and is not the keyboard's to handle.
 */
export function characterOfKey(key: string): KeyCharacter | null {
  const control = CONTROL_KEY_CODES.get(key);
  if (control !== undefined) {
    return { kind: 'codes', codes: [control] };
  }
  const point = key.codePointAt(0);
  if (point === undefined || String.fromCodePoint(point) !== key) {
    return null;
  }
  const codes = printableCodes(key);
  if (codes) {
    return { kind: 'codes', codes };
  }
  return point > 0x7f ? { kind: 'skipped', char: key } : null;
}

/** The control keys' codes, each of which a strict text carries as itself. */
const CONTROL_CODES: ReadonlySet<number> = new Set(CONTROL_KEY_CODES.values());

/** The control codes a paste sends; the rest a paste drops. */
const PASTED_CONTROL_CODES: ReadonlySet<number> = new Set([
  HORIZONTAL_TAB,
  LINE_FEED
]);

/** Whether `point` is printable Latin-1: ASCII from space, or 0xA0–0xFF. */
function isPrintable(point: number): boolean {
  return (point >= 0x20 && point <= 0x7e) || (point >= 0xa0 && point <= 0xff);
}

/**
 * The codes the one character `char` sends as printable text: itself in
 * Latin-1, its ASCII when folded, `null` otherwise.
 */
function printableCodes(char: string): readonly number[] | null {
  const folded = FOLDED_CHARACTERS.get(char);
  if (folded !== undefined) {
    return [...folded].map((c) => c.charCodeAt(0));
  }
  const point = char.codePointAt(0)!;
  return isPrintable(point) ? [point] : null;
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
  /** Every character neither Latin-1 nor folded, in order, each left out. */
  readonly skipped: readonly string[];
  /** Whether characters past `limit` codes were left out. */
  readonly truncated: boolean;
}

/**
 * The codes `text` sends, as a paste does: CRLF and a lone CR become LF, tab
 * and LF are sent, printable Latin-1 is sent as itself and typographic
 * punctuation as its ASCII, any other character above 0x7F is skipped and
 * listed, and every other control character is dropped. Stops before the
 * character whose codes would take it past `limit`.
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
    const sent = PASTED_CONTROL_CODES.has(point)
      ? [point]
      : printableCodes(char);
    if (sent) {
      if (codes.length + sent.length > limit) {
        truncated = true;
        break;
      }
      codes.push(...sent);
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
 * The codes `text` sends with nothing left out: printable Latin-1 as itself,
 * typographic punctuation as its ASCII, the codes of the control keys (LF,
 * tab, backspace, escape, delete, the arrows' and Home's) as themselves, and
 * CRLF and a lone CR as LF. Any other character makes the whole text
 * `unsendable`.
 */
export function textToCodesStrict(text: string): StrictKeyboardText {
  const codes: number[] = [];
  for (const { char, index } of textCharacters(text)) {
    const point = char.codePointAt(0)!;
    const sent = CONTROL_CODES.has(point) ? [point] : printableCodes(char);
    if (!sent) {
      return { kind: 'unsendable', char, index };
    }
    codes.push(...sent);
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
 * Ticks `KD` stays low after a release, or a cancel, before the next press
 * may raise it again, so a double letter still reads as two key-down pulses.
 */
const RELEASE_TICKS = 1;

/**
 * The event frames one key press is: what turns the route's pending count
 * into characters. A release is a state, so it never counts, and a cancel's
 * one event is fewer than a press's (see {@link cancelFrames}).
 */
const PRESS_EVENTS = 3;

/**
 * The keyboard's ten outputs: `D0` the least significant bit of `code`,
 * then `STB` and `KD` as `strobe` and `keyDown` say. A `null` code, strobe
 * or key down keeps what those outputs show.
 */
function outputs(
  code: number | null,
  strobe: boolean | null,
  keyDown: boolean | null
): (boolean | null)[] {
  const state: (boolean | null)[] = [];
  for (let bit = 0; bit < KEYBOARD_DATA_BITS; bit++) {
    state.push(code === null ? null : ((code >> bit) & 1) === 1);
  }
  state[KEYBOARD_STROBE_OUTPUT] = strobe;
  state[KEYBOARD_KEY_DOWN_OUTPUT] = keyDown;
  return state;
}

/**
 * A key going down, as three events with `KD` high in each: `D` takes
 * `code` with `STB` low, `STB` rises, and `STB` falls while `D` keeps the
 * code. The engine has no pulse of its own, so the third frame is what ends
 * the strobe. Pressed over a key still down, `KD` is high already and stays
 * so; `D` switches to the new code with a strobe of its own. A code outside
 * `1`…`0xFF` is refused: no key sends `0`.
 */
export function pressFrames(code: number): InputFrame[] {
  if (!Number.isInteger(code) || code < 1 || code >= 1 << KEYBOARD_DATA_BITS) {
    throw new RangeError(`Not a code the keyboard sends: ${code}`);
  }
  return [
    { state: outputs(code, false, true), hold: PRESS_FRAME_TICKS },
    { state: outputs(code, true, true), hold: PRESS_FRAME_TICKS },
    { state: outputs(code, false, true), hold: PRESS_FRAME_TICKS }
  ];
}

/**
 * The last key down going up: `KD` low, held for {@link RELEASE_TICKS}. `D`
 * keeps the last code, latched until the next press replaces it, and `STB`,
 * low after every press, stays low. A state rather than an event, so it
 * stays out of the pending count; it never merges into a press, which ends
 * in an event.
 */
export function releaseFrame(): InputFrame {
  return {
    state: outputs(null, false, false),
    hold: RELEASE_TICKS,
    coalesce: true
  };
}

/**
 * Each code pressed and released, in order: four ticks a character, `KD`
 * high for the first three and low for the fourth.
 */
export function tapFrames(codes: readonly number[]): InputFrame[] {
  return codes.flatMap((code) => [...pressFrames(code), releaseFrame()]);
}

/**
 * A cancel, sent in place of every frame still queued: `STB` low, then `KD`
 * low, `D` kept throughout.
 *
 * The first frame lowers `STB` and keeps `D` and `KD`, as a press's third
 * frame does. A cancel ends whatever hold was running, so it is on the
 * outputs after the next tick, and a character whose strobe had already
 * risen keeps its code on `D` for the tick after the strobe falls, exactly
 * as an uncut press would; a circuit whose strobe path has a gate more than
 * its data path still latches it. It is an event so that the second frame,
 * a state, cannot merge into it and take that tick away, and neither can a
 * release sent after the cancel.
 *
 * The second frame lowers `KD` like a release and holds as long as one, so
 * the next press raises it again no sooner than a tick later. It lets go of
 * every key held.
 *
 * The one event never counts as a character: a press is three, and
 * {@link pendingCharacters} rounds down, so one event alone, or ahead of
 * whole presses, adds nothing. It always fits: the cancel replaces what the
 * input had queued, so the engine counts only its own frames against the
 * limit, one event of {@link INPUT_QUEUE_LIMIT}.
 */
export function cancelFrames(): InputFrame[] {
  return [
    { state: outputs(null, false, null), hold: PRESS_FRAME_TICKS },
    releaseFrame()
  ];
}

/**
 * How many characters are queued and not yet on `D`, from how many event
 * frames the keyboard's input has not yet applied: a character whose first
 * press frame is applied is on `D` already, and a cancel's one event is no
 * character, so the count rounds down.
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
