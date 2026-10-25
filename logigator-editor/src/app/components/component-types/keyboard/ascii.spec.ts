import { describe, expect, it } from 'vitest';
import {
  BuiltInComponentType,
  KEYBOARD_DATA_BITS,
  KEYBOARD_KEY_DOWN_OUTPUT,
  KEYBOARD_STROBE_OUTPUT
} from '@logigator/core';
import type { InputFrame } from '../../component-inspection';
import type { BoardDescriptor } from '../../../simulation/compiler/compiled-board.model';
import { SimEngine, userInputBoard } from '../../../../testing/sim-engine';
import { CANVAS_FONT_CHARS } from '../../../utils/text-fit';
import {
  cancelFrames,
  characterOfKey,
  codeFromBits,
  KEYBOARD_MNEMONICS,
  pendingCharacters,
  pressFrames,
  readoutText,
  releaseFrame,
  tapFrames,
  textToCodes,
  textToCodesStrict
} from './ascii';

/**
 * Every code the keyboard sends: for every control key and every character
 * of the BMP, as a key, as a strict text and as a paste.
 */
function everyCodeSent(): Set<number> {
  const sent = new Set<number>();
  const keys = [
    'Enter',
    'Backspace',
    'Tab',
    'Escape',
    'Delete',
    'ArrowRight',
    'ArrowLeft',
    'ArrowUp',
    'ArrowDown',
    'Home'
  ];
  let all = '';
  for (let point = 0; point <= 0xffff; point++) {
    if (point >= 0xd800 && point <= 0xdfff) continue;
    const char = String.fromCodePoint(point);
    all += char;
    keys.push(char);
  }
  for (const key of keys) {
    const character = characterOfKey(key);
    if (character?.kind === 'codes') {
      character.codes.forEach((code) => sent.add(code));
    }
    const strict = textToCodesStrict(key);
    if (strict.kind === 'codes') {
      strict.codes.forEach((code) => sent.add(code));
    }
  }
  textToCodes(all, Infinity).codes.forEach((code) => sent.add(code));
  return sent;
}

/** Whether every character of `text` is in the canvas font's atlas. */
function inCanvasAtlas(text: string): boolean {
  return [...text].every((char) =>
    CANVAS_FONT_CHARS.some(([from, to]) => char >= from && char <= to)
  );
}

describe('keyboard codes', () => {
  it('reads every control key the keyboard sends as its mnemonic', () => {
    expect(readoutText(0x0a)).toBe('LF');
    expect(readoutText(0x08)).toBe('BS');
    expect(readoutText(0x09)).toBe('TAB');
    expect(readoutText(0x1b)).toBe('ESC');
    expect(readoutText(0x7f)).toBe('DEL');
    expect(readoutText(0x20)).toBe('SP');
    expect(readoutText(0x1c)).toBe('RT');
    expect(readoutText(0x1d)).toBe('LT');
    expect(readoutText(0x1e)).toBe('UP');
    expect(readoutText(0x1f)).toBe('DN');
    expect(readoutText(0x0b)).toBe('HOM');
  });

  it('reads a printable Latin-1 character as itself, the two invisible ones by name, and zero as nothing', () => {
    for (const [from, to] of [
      [0x21, 0x7e],
      [0xa1, 0xff]
    ]) {
      for (let code = from; code <= to; code++) {
        if (code === 0xad) continue;
        expect(readoutText(code)).toBe(String.fromCharCode(code));
      }
    }
    expect(readoutText(0xa0)).toBe('NBS');
    expect(readoutText(0xad)).toBe('SHY');
    expect(readoutText(0)).toBe('');
  });

  it('gives every code the keyboard sends a readout of at most three glyphs of the canvas atlas, all mnemonics distinct', () => {
    const sent = everyCodeSent();
    for (const code of sent) {
      const text = readoutText(code);
      expect(text.length, `code ${code}`).toBeGreaterThan(0);
      expect(text.length, `code ${code}`).toBeLessThanOrEqual(3);
      // BitmapText drops a glyph outside the atlas, which starts at space.
      expect(inCanvasAtlas(text), `code ${code}: ${text}`).toBe(true);
    }
    for (const mnemonic of KEYBOARD_MNEMONICS.values()) {
      expect(/^[!-~]{2,3}$/.test(mnemonic), mnemonic).toBe(true);
    }
    expect(new Set(KEYBOARD_MNEMONICS.values()).size).toBe(
      KEYBOARD_MNEMONICS.size
    );
  });

  it('sends nothing but printable Latin-1 and the control keys’ codes, never NUL and never a C1 code', () => {
    const sent = everyCodeSent();
    const expected = new Set([
      0x08, 0x09, 0x0a, 0x0b, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x7f
    ]);
    for (let code = 0x20; code <= 0x7e; code++) expected.add(code);
    for (let code = 0xa0; code <= 0xff; code++) expected.add(code);
    expect([...sent].sort((a, b) => a - b)).toEqual(
      [...expected].sort((a, b) => a - b)
    );
    expect(textToCodesStrict('\u0000').kind).toBe('unsendable');
    expect(() => pressFrames(0)).toThrow(RangeError);
    expect(() => pressFrames(0x100)).toThrow(RangeError);
  });

  it('decodes D0 as the least significant of eight bits', () => {
    for (let code = 0; code <= 0xff; code++) {
      expect(codeFromBits((bit) => ((code >> bit) & 1) === 1)).toBe(code);
    }
    // A ninth bit is not a data output.
    expect(codeFromBits((bit) => bit === 8)).toBe(0);
  });

  it('sends each control key and every printable Latin-1 key as its code', () => {
    const controls: [string, number][] = [
      ['Enter', 0x0a],
      ['Backspace', 0x08],
      ['Tab', 0x09],
      ['Escape', 0x1b],
      ['Delete', 0x7f],
      ['ArrowRight', 0x1c],
      ['ArrowLeft', 0x1d],
      ['ArrowUp', 0x1e],
      ['ArrowDown', 0x1f],
      ['Home', 0x0b],
      [' ', 0x20],
      [' ', 0xa0]
    ];
    for (const [key, code] of controls) {
      expect(characterOfKey(key), key).toEqual({
        kind: 'codes',
        codes: [code]
      });
    }
    for (const [from, to] of [
      [0x21, 0x7e],
      [0xa1, 0xff]
    ]) {
      for (let code = from; code <= to; code++) {
        expect(characterOfKey(String.fromCharCode(code))).toEqual({
          kind: 'codes',
          codes: [code]
        });
      }
    }
  });

  it('sends a key of typographic punctuation as the ASCII it stands in for', () => {
    const folded: [string, string][] = [
      ['‘’‚‛', "'"],
      ['“”„‟', '"'],
      ['‒–—―', '-']
    ];
    for (const [chars, ascii] of folded) {
      for (const char of chars) {
        expect(characterOfKey(char), char).toEqual({
          kind: 'codes',
          codes: [ascii.charCodeAt(0)]
        });
      }
    }
    expect(characterOfKey('…')).toEqual({
      kind: 'codes',
      codes: [0x2e, 0x2e, 0x2e]
    });
  });

  it('skips a character outside Latin-1 and leaves keys without one alone', () => {
    for (const char of ['€', 'ő', '\u0085', '😀']) {
      expect(characterOfKey(char)).toEqual({ kind: 'skipped', char });
    }
    for (const key of ['F1', 'End', 'PageUp', 'Insert', 'Shift', 'Dead']) {
      expect(characterOfKey(key), key).toBeNull();
    }
  });

  it('ends every line of a text with LF and drops the other control characters, the cursor codes among them', () => {
    const text = textToCodes(
      'a\r\nb\rc\n\td\u0000\u0007\u000b\u001b\u001c\u001f\u007fe'
    );
    expect(String.fromCharCode(...text.codes)).toBe('a\nb\nc\n\tde');
    expect(text.skipped).toEqual([]);
    expect(text.truncated).toBe(false);
  });

  it('sends a text’s Latin-1 as itself and folds its typographic punctuation before skipping the rest', () => {
    const text = textToCodes('„Grüße“ – 20 € … ’n 😀\u0085!');
    expect(String.fromCharCode(...text.codes)).toBe('"Grüße" - 20  ... \'n !');
    expect(text.skipped).toEqual(['€', '😀', '\u0085']);
  });

  it('reads a text strictly as every control key and printable character, CRLF and CR as LF', () => {
    const text = textToCodesStrict(
      'a\r\nb\rc\n\t\b\u001b\u007f\u001c\u001d\u001e\u001f\u000b ~ÿ'
    );
    expect(text).toEqual({
      kind: 'codes',
      codes: [
        0x61, 0x0a, 0x62, 0x0a, 0x63, 0x0a, 0x09, 0x08, 0x1b, 0x7f, 0x1c, 0x1d,
        0x1e, 0x1f, 0x0b, 0x20, 0x7e, 0xff
      ]
    });
    expect(textToCodesStrict('“ä…”')).toEqual({
      kind: 'codes',
      codes: [0x22, 0xe4, 0x2e, 0x2e, 0x2e, 0x22]
    });
  });

  it('refuses a strict text at its first unsendable character, by its index in the text', () => {
    expect(textToCodesStrict('😀a\r\n€ä')).toEqual({
      kind: 'unsendable',
      char: '😀',
      index: 0
    });
    expect(textToCodesStrict('ä\r\n€')).toEqual({
      kind: 'unsendable',
      char: '€',
      index: 3
    });
    for (const char of ['\u0007', '\u000c', '\u0085']) {
      expect(textToCodesStrict(`ok${char}`)).toEqual({
        kind: 'unsendable',
        char,
        index: 2
      });
    }
  });

  it('stops a text after the limit and says so, never cutting a folded character', () => {
    expect(textToCodes('abc', 3)).toEqual({
      codes: [0x61, 0x62, 0x63],
      skipped: [],
      truncated: false
    });
    const cut = textToCodes('ab\ncd', 3);
    expect(cut.codes).toEqual([0x61, 0x62, 0x0a]);
    expect(cut.truncated).toBe(true);

    expect(textToCodes('a…', 4).codes).toEqual([0x61, 0x2e, 0x2e, 0x2e]);
    const ellipsis = textToCodes('ab…', 4);
    expect(ellipsis.codes).toEqual([0x61, 0x62]);
    expect(ellipsis.truncated).toBe(true);
  });
});

/** What a keyboard's outputs show after one tick. */
interface KeyboardSample {
  code: number;
  strobe: boolean;
  keyDown: boolean;
}

/** A sample as the timing tables write a tick: `D`, `STB`, `KD`. */
function tick(code: number, strobe: 0 | 1, keyDown: 0 | 1): KeyboardSample {
  return { code, strobe: strobe === 1, keyDown: keyDown === 1 };
}

/** The keyboard's outputs: `D0`…`D7`, `STB`, `KD`. */
const KEYBOARD_OUTPUTS = KEYBOARD_KEY_DOWN_OUTPUT + 1;

/**
 * The real engine running one keyboard input — the one unit of ten outputs
 * the compiler emits for it, `D0`…`D7`, `STB`, then `KD` — with the frames
 * this module builds sent as the keyboard sends them. The keyboard is unit 0
 * of `board`, which can wire a circuit to it.
 */
class KeyboardOnEngine {
  public readonly engine: SimEngine;

  constructor(board = userInputBoard(1, KEYBOARD_OUTPUTS)) {
    this.engine = new SimEngine(board);
  }

  public send(frames: readonly InputFrame[], replace = false): void {
    this.engine.submit([
      {
        comp: 0,
        frames: frames.map((frame) => ({ ...frame, state: [...frame.state] })),
        replace
      }
    ]);
  }

  /** One tick, and what the outputs show after it. */
  public step(): KeyboardSample {
    this.engine.step();
    return this.sample();
  }

  public steps(count: number): KeyboardSample[] {
    return Array.from({ length: count }, () => this.step());
  }

  public sample(): KeyboardSample {
    return {
      code: codeFromBits((bit) => this.engine.output(0, bit)),
      strobe: this.engine.output(0, KEYBOARD_STROBE_OUTPUT),
      keyDown: this.engine.output(0, KEYBOARD_KEY_DOWN_OUTPUT)
    };
  }

  /** The characters the window would say are still to go out. */
  public pendingCharacters(): number {
    return pendingCharacters(this.engine.pending(0));
  }
}

/** The code on `D` at every rising edge of `STB`, as a latch reads it. */
function latched(trace: readonly KeyboardSample[]): number[] {
  return trace
    .filter(({ strobe }, i) => strobe && !trace[i - 1]?.strobe)
    .map(({ code }) => code);
}

/** How many times `KD` rose: the presses a counter on it counts. */
function keyDownPulses(trace: readonly KeyboardSample[]): number {
  return trace.filter(({ keyDown }, i) => keyDown && !trace[i - 1]?.keyDown)
    .length;
}

describe('keyboard frames on the engine', () => {
  const text = 'Hello,\n\twörld!! ~0x7F ÿ½';
  const codes = textToCodes(text).codes;

  it('puts a tap on D with KD a tick before its strobe, lowers KD after three ticks and keeps D', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames([0x41]));

    // Submitted at tick 0: on the outputs after tick 1.
    expect(keyboard.steps(6)).toEqual([
      tick(0x41, 0, 1),
      tick(0x41, 1, 1),
      tick(0x41, 0, 1),
      tick(0x41, 0, 0),
      tick(0x41, 0, 0),
      tick(0x41, 0, 0)
    ]);
  });

  it('types a double letter as two strobes and two KD pulses, D never back to 0', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames([0x6c, 0x6c]));

    expect(keyboard.steps(9)).toEqual([
      tick(0x6c, 0, 1),
      tick(0x6c, 1, 1),
      tick(0x6c, 0, 1),
      tick(0x6c, 0, 0),
      tick(0x6c, 0, 1),
      tick(0x6c, 1, 1),
      tick(0x6c, 0, 1),
      tick(0x6c, 0, 0),
      tick(0x6c, 0, 0)
    ]);
  });

  it('types a text a latch on the strobe reads back exactly and a counter on KD counts exactly, double letters included', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(codes));

    const trace = keyboard.steps(codes.length * 4 + 4);

    expect(String.fromCharCode(...latched(trace))).toBe(text);
    expect(keyDownPulses(trace)).toBe(codes.length);
    expect(trace.at(-1)).toEqual(tick(codes.at(-1)!, 0, 0));
  });

  it('reads every code with D7 set back exactly, the cursor keys’ codes and folded punctuation among them', () => {
    const read = textToCodesStrict(
      '„Grüße“ ÷ ×\u001c\u001d\u001e\u001f\u000bÿ…'
    );
    if (read.kind !== 'codes') throw new Error('unsendable');
    const sent = [...read.codes];
    for (let code = 0xa0; code <= 0xff; code++) sent.push(code);
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(sent));

    const trace = keyboard.steps(sent.length * 4 + 4);

    expect(latched(trace)).toEqual(sent);
    expect(String.fromCharCode(...latched(trace).slice(0, 7))).toBe('"Grüße"');
    expect(keyDownPulses(trace)).toBe(sent.length);
  });

  it('puts a key typed while paused on D with KD after the next step and strobes it after the one after', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.steps(5);

    keyboard.send(pressFrames(0x41));

    expect(keyboard.sample()).toEqual(tick(0, 0, 0));
    expect(keyboard.step()).toEqual(tick(0x41, 0, 1));
    expect(keyboard.step()).toEqual(tick(0x41, 1, 1));
  });

  it('keeps KD high while a pressed key is held, and its release lowers KD alone, waiting for nothing else', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    const held = keyboard.steps(10);
    keyboard.send([releaseFrame()]);

    expect(latched(held)).toEqual([0x61]);
    expect(held.every(({ keyDown }) => keyDown)).toBe(true);
    expect(keyboard.step()).toEqual(tick(0x61, 0, 0));
  });

  it('switches D to a key pressed over a held one with a strobe of its own, KD high throughout and never 0 on D', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    const first = keyboard.steps(3);
    keyboard.send(pressFrames(0x62));
    const trace = [...first, ...keyboard.steps(3)];

    expect(trace).toEqual([
      tick(0x61, 0, 1),
      tick(0x61, 1, 1),
      tick(0x61, 0, 1),
      tick(0x62, 0, 1),
      tick(0x62, 1, 1),
      tick(0x62, 0, 1)
    ]);
  });

  it('counts the characters not yet sent down to zero, a release never among them', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(codes));
    const counts = [keyboard.pendingCharacters()];
    const trace: KeyboardSample[] = [];
    while (counts.at(-1)! > 0) {
      trace.push(keyboard.step());
      counts.push(keyboard.pendingCharacters());
    }

    // After each tick, the count is what KD has not yet risen for.
    expect(counts[0]).toBe(codes.length);
    trace.forEach((_, tick) => {
      expect(counts[tick + 1]).toBe(
        codes.length - keyDownPulses(trace.slice(0, tick + 1))
      );
    });
    // The last character is on D the moment the count reaches zero, its
    // strobe still to come.
    expect(trace.at(-1)).toEqual(tick(codes.at(-1)!, 0, 1));
    expect(keyboard.step()).toEqual(tick(codes.at(-1)!, 1, 1));
  });

  it('counts a held key only until it is on D, and neither its release nor a cancel', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    expect(keyboard.pendingCharacters()).toBe(1);
    keyboard.step();
    expect(keyboard.pendingCharacters()).toBe(0);
    keyboard.steps(2);
    expect(keyboard.engine.pending(0)).toBe(0);

    keyboard.send([releaseFrame()]);
    expect(keyboard.engine.pending(0)).toBe(0);
    // The cancel's one event, alone and ahead of a press.
    keyboard.send(cancelFrames(), true);
    expect(keyboard.engine.pending(0)).toBe(1);
    expect(keyboard.pendingCharacters()).toBe(0);
    keyboard.send(pressFrames(0x62));
    expect(keyboard.pendingCharacters()).toBe(1);
  });

  it('cancels a text on its strobe tick: STB falls with the code still on D, then KD, and the rest is dropped', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(codes));
    keyboard.step();
    expect(keyboard.step()).toEqual(tick(codes[0], 1, 1));

    keyboard.send(cancelFrames(), true);

    expect(keyboard.pendingCharacters()).toBe(0);
    const after = keyboard.steps(codes.length * 4);
    expect(after.slice(0, 2)).toEqual([
      tick(codes[0], 0, 1),
      tick(codes[0], 0, 0)
    ]);
    expect(after.slice(2)).toEqual(
      new Array(after.length - 2).fill(tick(codes[0], 0, 0))
    );
  });

  it('waits out the cancel before the next character, so KD is low a tick before it', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    expect(keyboard.steps(2).at(-1)).toEqual(tick(0x61, 1, 1));
    keyboard.send(cancelFrames(), true);
    keyboard.send(tapFrames([0x62]));

    expect(keyboard.steps(6)).toEqual([
      tick(0x61, 0, 1),
      tick(0x61, 0, 0),
      tick(0x62, 0, 1),
      tick(0x62, 1, 1),
      tick(0x62, 0, 1),
      tick(0x62, 0, 0)
    ]);
  });
});

/**
 * A keyboard whose `D0`…`D7` a D flip-flop each latches on `STB`'s rising
 * edge, with `dataGates` delays on every data bit's way to its flip-flop and
 * `strobeGates` on the strobe's: a delay is a buffer, one gate, so this is
 * the skew a circuit gets from one path having more gates than the other.
 */
function latchBoard(
  dataGates: number,
  strobeGates: number
): { board: BoardDescriptor; clock: number; q: number[] } {
  const board = userInputBoard(1, KEYBOARD_OUTPUTS);
  let links = KEYBOARD_OUTPUTS;
  const delayed = (link: number, gates: number): number => {
    for (let gate = 0; gate < gates; gate++) {
      board.components.push({
        type: BuiltInComponentType.DELAY,
        inputs: [link],
        outputs: [links]
      });
      link = links++;
    }
    return link;
  };
  const clock = delayed(KEYBOARD_STROBE_OUTPUT, strobeGates);
  const q: number[] = [];
  for (let bit = 0; bit < KEYBOARD_DATA_BITS; bit++) {
    const data = delayed(bit, dataGates);
    q.push(links);
    board.components.push({
      type: BuiltInComponentType.D_FF,
      inputs: [data, clock],
      outputs: [links, links + 1]
    });
    links += 2;
  }
  return { board, clock, q };
}

/**
 * Ticks a {@link latchBoard}: each call runs `ticks` ticks and returns every
 * code its flip-flops stored meanwhile. A flip-flop stores what D shows on
 * the tick its clock rises, and its Q shows it a tick later, one gate on.
 */
function latchReader(
  keyboard: KeyboardOnEngine,
  { clock, q }: { clock: number; q: number[] }
): (ticks: number) => number[] {
  let high = false;
  let stored = false;
  return (ticks) => {
    const read: number[] = [];
    for (let tick = 0; tick < ticks; tick++) {
      keyboard.engine.step();
      if (stored) {
        read.push(codeFromBits((bit) => keyboard.engine.link(q[bit])));
      }
      const now = keyboard.engine.link(clock);
      stored = now && !high;
      high = now;
    }
    return read;
  };
}

describe('keyboard frames latched by a circuit on the engine', () => {
  const text = 'Hello,\n\twörld!! ~0x7F ÿ½';
  const codes = textToCodes(text).codes;
  const skews = [
    ['wired straight to the keyboard', 0, 0],
    ['with one gate more on every data bit than on the strobe', 1, 0],
    ['with one gate more on the strobe than on the data bits', 0, 1]
  ] as const;

  it.each(skews)(
    'reads a text back exactly, double letters included, from flip-flops %s',
    (_, dataGates, strobeGates) => {
      const circuit = latchBoard(dataGates, strobeGates);
      const keyboard = new KeyboardOnEngine(circuit.board);
      keyboard.send(tapFrames(codes));

      const read = latchReader(keyboard, circuit)(codes.length * 4 + 4);

      expect(String.fromCharCode(...read)).toBe(text);
    }
  );

  it.each(skews)(
    'still delivers a character cancelled on its strobe tick, and nothing after it, to flip-flops %s',
    (_, dataGates, strobeGates) => {
      const circuit = latchBoard(dataGates, strobeGates);
      const keyboard = new KeyboardOnEngine(circuit.board);
      keyboard.send(tapFrames(codes));
      const read = latchReader(keyboard, circuit);
      const before = read(2);
      expect(keyboard.sample()).toEqual(tick(codes[0], 1, 1));

      keyboard.send(cancelFrames(), true);

      expect([...before, ...read(8)]).toEqual([codes[0]]);
    }
  );
});
