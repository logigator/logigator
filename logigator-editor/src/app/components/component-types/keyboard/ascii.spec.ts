import { describe, expect, it } from 'vitest';
import {
  BuiltInComponentType,
  KEYBOARD_DATA_BITS,
  KEYBOARD_STROBE_OUTPUT
} from '@logigator/core';
import type { InputFrame } from '../../component-inspection';
import type { BoardDescriptor } from '../../../simulation/compiler/compiled-board.model';
import { SimEngine, userInputBoard } from '../../../../testing/sim-engine';
import {
  ASCII_MNEMONICS,
  characterOfKey,
  codeFromBits,
  pendingCharacters,
  pressFrames,
  readoutText,
  releaseFrame,
  resetFrame,
  tapFrames,
  textToCodes,
  textToCodesStrict
} from './ascii';

describe('keyboard ASCII', () => {
  it('reads every control key the keyboard sends as its mnemonic', () => {
    expect(readoutText(0x0a)).toBe('LF');
    expect(readoutText(0x08)).toBe('BS');
    expect(readoutText(0x09)).toBe('TAB');
    expect(readoutText(0x1b)).toBe('ESC');
    expect(readoutText(0x7f)).toBe('DEL');
    expect(readoutText(0x20)).toBe('SP');
  });

  it('reads a printable character as itself and zero as nothing', () => {
    for (let code = 0x21; code <= 0x7e; code++) {
      expect(readoutText(code)).toBe(String.fromCharCode(code));
    }
    expect(readoutText(0)).toBe('');
  });

  it('gives every non-zero code a readout of at most three canvas glyphs', () => {
    for (let code = 1; code <= 0x7f; code++) {
      const text = readoutText(code);
      expect(text.length, `code ${code}`).toBeGreaterThan(0);
      expect(text.length, `code ${code}`).toBeLessThanOrEqual(3);
      // The canvas atlas starts at space; a control character would draw
      // nothing.
      expect(/^[!-~]+$/.test(text), `code ${code}: ${text}`).toBe(true);
    }
    expect(new Set(ASCII_MNEMONICS.values()).size).toBe(ASCII_MNEMONICS.size);
  });

  it('decodes D0 as the least significant of seven bits', () => {
    for (let code = 0; code <= 0x7f; code++) {
      expect(codeFromBits((bit) => ((code >> bit) & 1) === 1)).toBe(code);
    }
    // An eighth bit is not a data output.
    expect(codeFromBits((bit) => bit === 7)).toBe(0);
  });

  it('sends each control key and every printable key as its code', () => {
    const controls: [string, number][] = [
      ['Enter', 0x0a],
      ['Backspace', 0x08],
      ['Tab', 0x09],
      ['Escape', 0x1b],
      ['Delete', 0x7f],
      [' ', 0x20]
    ];
    for (const [key, code] of controls) {
      expect(characterOfKey(key), key).toEqual({ kind: 'ascii', code });
    }
    for (let code = 0x21; code <= 0x7e; code++) {
      expect(characterOfKey(String.fromCharCode(code))).toEqual({
        kind: 'ascii',
        code
      });
    }
  });

  it('skips a character outside ASCII and leaves keys without one alone', () => {
    for (const char of ['ä', '€', '°', '😀']) {
      expect(characterOfKey(char)).toEqual({ kind: 'skipped', char });
    }
    for (const key of ['ArrowUp', 'F1', 'Home', 'Insert', 'Shift', 'Dead']) {
      expect(characterOfKey(key), key).toBeNull();
    }
  });

  it('ends every line of a text with LF and drops the other control characters', () => {
    const text = textToCodes('a\r\nb\rc\n\td\u0000\u0007\u001b\u007fe');
    expect(String.fromCharCode(...text.codes)).toBe('a\nb\nc\n\tde');
    expect(text.skipped).toEqual([]);
    expect(text.truncated).toBe(false);
  });

  it('skips and lists every character of a text outside ASCII', () => {
    const text = textToCodes('Grüße, 20 €😀!');
    expect(String.fromCharCode(...text.codes)).toBe('Gre, 20 !');
    expect(text.skipped).toEqual(['ü', 'ß', '€', '😀']);
  });

  it('reads a text strictly as every control key and printable character, CRLF and CR as LF', () => {
    const text = textToCodesStrict('a\r\nb\rc\n\t\b\u001b\u007f ~');
    expect(text).toEqual({
      kind: 'codes',
      codes: [
        0x61, 0x0a, 0x62, 0x0a, 0x63, 0x0a, 0x09, 0x08, 0x1b, 0x7f, 0x20, 0x7e
      ]
    });
  });

  it('refuses a strict text at its first unsendable character, by its index in the text', () => {
    expect(textToCodesStrict('😀a\r\nä€')).toEqual({
      kind: 'unsendable',
      char: '😀',
      index: 0
    });
    expect(textToCodesStrict('a\r\nä€')).toEqual({
      kind: 'unsendable',
      char: 'ä',
      index: 3
    });
    expect(textToCodesStrict('ok\u0007')).toEqual({
      kind: 'unsendable',
      char: '\u0007',
      index: 2
    });
  });

  it('stops a text after the limit and says so', () => {
    expect(textToCodes('abc', 3)).toEqual({
      codes: [0x61, 0x62, 0x63],
      skipped: [],
      truncated: false
    });
    const cut = textToCodes('ab\ncd', 3);
    expect(cut.codes).toEqual([0x61, 0x62, 0x0a]);
    expect(cut.truncated).toBe(true);
  });

  it('never produces NUL, from a key or from text', () => {
    let all = '';
    for (let point = 0; point <= 0xffff; point++) {
      if (point >= 0xd800 && point <= 0xdfff) continue;
      const char = String.fromCodePoint(point);
      all += char;
      const character = characterOfKey(char);
      if (character?.kind === 'ascii') {
        expect(character.code, `U+${point.toString(16)}`).not.toBe(0);
      }
    }
    expect(textToCodes(all, Infinity).codes).not.toContain(0);
    expect(textToCodesStrict('\u0000').kind).toBe('unsendable');
    expect(() => pressFrames(0)).toThrow(RangeError);
  });
});

/** What a keyboard's outputs show after one tick. */
interface KeyboardSample {
  code: number;
  strobe: boolean;
}

/**
 * The real engine running one keyboard input — the one unit of eight outputs
 * the compiler emits for it, `D0`…`D6` then `STB` — with the frames this
 * module builds sent as the keyboard sends them. The keyboard is unit 0 of
 * `board`, which can wire a circuit to it.
 */
class KeyboardOnEngine {
  public readonly engine: SimEngine;

  constructor(board = userInputBoard(1, KEYBOARD_DATA_BITS + 1)) {
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
      strobe: this.engine.output(0, KEYBOARD_STROBE_OUTPUT)
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

/** How many times `D` rose from 0 to a code: the characters put on it. */
function arrivals(trace: readonly KeyboardSample[]): number {
  return trace.filter(({ code }, i) => code !== 0 && !trace[i - 1]?.code)
    .length;
}

describe('keyboard frames on the engine', () => {
  const text = 'Hello,\n\tworld!! ~0x7F';
  const codes = textToCodes(text).codes;

  it('types a text a latch on the strobe reads back exactly, double letters included', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(codes));

    const trace = keyboard.steps(codes.length * 4 + 4);

    expect(String.fromCharCode(...latched(trace))).toBe(text);
    expect(trace.at(-1)).toEqual({ code: 0, strobe: false });
  });

  it('keeps every character on D three ticks, its strobe the middle one, then D zero a tick', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames([0x6c, 0x6c]));

    // Submitted at tick 0: each character takes four ticks from the next one.
    expect(keyboard.steps(9)).toEqual([
      { code: 0x6c, strobe: false },
      { code: 0x6c, strobe: true },
      { code: 0x6c, strobe: false },
      { code: 0, strobe: false },
      { code: 0x6c, strobe: false },
      { code: 0x6c, strobe: true },
      { code: 0x6c, strobe: false },
      { code: 0, strobe: false },
      { code: 0, strobe: false }
    ]);
  });

  it('puts a key typed while paused on D after the next step and strobes it after the one after', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.steps(5);

    keyboard.send(pressFrames(0x41));

    expect(keyboard.sample()).toEqual({ code: 0, strobe: false });
    expect(keyboard.step()).toEqual({ code: 0x41, strobe: false });
    expect(keyboard.step()).toEqual({ code: 0x41, strobe: true });
  });

  it('holds a pressed key on D until its release, which waits for nothing else', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    const held = keyboard.steps(10);
    keyboard.send([releaseFrame()]);

    expect(latched(held)).toEqual([0x61]);
    expect(held.at(-1)).toEqual({ code: 0x61, strobe: false });
    expect(keyboard.step()).toEqual({ code: 0, strobe: false });
  });

  it('strobes again for a key pressed over the held one, with no zero between', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    keyboard.send(pressFrames(0x62));

    const trace = keyboard.steps(6);

    expect(latched(trace)).toEqual([0x61, 0x62]);
    expect(trace.map(({ code }) => code)).not.toContain(0);
  });

  it('counts the characters not yet on D down to zero, a release never among them', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(codes));
    const counts = [keyboard.pendingCharacters()];
    const trace: KeyboardSample[] = [];
    while (counts.at(-1)! > 0) {
      trace.push(keyboard.step());
      counts.push(keyboard.pendingCharacters());
    }

    // After each tick, the count is what D has not yet risen to from 0.
    expect(counts[0]).toBe(codes.length);
    trace.forEach((_, tick) => {
      expect(counts[tick + 1]).toBe(
        codes.length - arrivals(trace.slice(0, tick + 1))
      );
    });
    // The last character is on D the moment the count reaches zero, its
    // strobe still to come.
    expect(trace.at(-1)).toEqual({ code: codes.at(-1), strobe: false });
    expect(keyboard.step()).toEqual({ code: codes.at(-1), strobe: true });
  });

  it('counts a held key only until it is on D, and neither its release nor a reset', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    expect(keyboard.pendingCharacters()).toBe(1);
    keyboard.step();
    expect(keyboard.pendingCharacters()).toBe(0);
    keyboard.steps(2);
    expect(keyboard.engine.pending(0)).toBe(0);

    keyboard.send([releaseFrame()]);
    expect(keyboard.engine.pending(0)).toBe(0);
    keyboard.send([resetFrame()], true);
    expect(keyboard.engine.pending(0)).toBe(0);
  });

  it('cancels a text with a reset that drops the rest and ends a strobe cut short', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(tapFrames(codes));
    keyboard.step();
    expect(keyboard.step()).toEqual({ code: codes[0], strobe: true });

    keyboard.send([resetFrame()], true);

    expect(keyboard.pendingCharacters()).toBe(0);
    const after = keyboard.steps(codes.length * 4);
    expect(after.every((sample) => sample.code === 0 && !sample.strobe)).toBe(
      true
    );
  });

  it('waits out the reset before the next character, so D is zero a tick before it', () => {
    const keyboard = new KeyboardOnEngine();
    keyboard.send(pressFrames(0x61));
    expect(keyboard.steps(2).at(-1)).toEqual({ code: 0x61, strobe: true });
    keyboard.send([resetFrame()], true);
    keyboard.send(tapFrames([0x61]));

    expect(keyboard.steps(5)).toEqual([
      { code: 0, strobe: false },
      { code: 0x61, strobe: false },
      { code: 0x61, strobe: true },
      { code: 0x61, strobe: false },
      { code: 0, strobe: false }
    ]);
  });
});

/**
 * A keyboard whose `D0`…`D6` a D flip-flop each latches on `STB`'s rising
 * edge, with `dataGates` delays on every data bit's way to its flip-flop and
 * `strobeGates` on the strobe's: a delay is a buffer, one gate, so this is
 * the skew a circuit gets from one path having more gates than the other.
 */
function latchBoard(
  dataGates: number,
  strobeGates: number
): { board: BoardDescriptor; clock: number; q: number[] } {
  const board = userInputBoard(1, KEYBOARD_DATA_BITS + 1);
  const delayed = (link: number, gates: number): number => {
    for (let gate = 0; gate < gates; gate++) {
      board.components.push({
        type: BuiltInComponentType.DELAY,
        inputs: [link],
        outputs: [board.links]
      });
      link = board.links++;
    }
    return link;
  };
  const clock = delayed(KEYBOARD_STROBE_OUTPUT, strobeGates);
  const q: number[] = [];
  for (let bit = 0; bit < KEYBOARD_DATA_BITS; bit++) {
    const data = delayed(bit, dataGates);
    q.push(board.links);
    board.components.push({
      type: BuiltInComponentType.D_FF,
      inputs: [data, clock],
      outputs: [board.links, board.links + 1]
    });
    board.links += 2;
  }
  return { board, clock, q };
}

describe('keyboard frames latched by a circuit on the engine', () => {
  const text = 'Hello,\n\tworld!! ~0x7F';
  const codes = textToCodes(text).codes;

  it.each([
    ['wired straight to the keyboard', 0, 0],
    ['with one gate more on every data bit than on the strobe', 1, 0],
    ['with one gate more on the strobe than on the data bits', 0, 1]
  ])(
    'reads a text back exactly, double letters included, from flip-flops %s',
    (_, dataGates, strobeGates) => {
      const { board, clock, q } = latchBoard(dataGates, strobeGates);
      const keyboard = new KeyboardOnEngine(board);
      keyboard.send(tapFrames(codes));

      // A flip-flop stores what D shows on the tick its clock rises, and its
      // Q shows it a tick later, one gate on.
      const read: number[] = [];
      let high = false;
      let stored = false;
      for (let tick = 0; tick < codes.length * 4 + 4; tick++) {
        keyboard.engine.step();
        if (stored) {
          read.push(codeFromBits((bit) => keyboard.engine.link(q[bit])));
        }
        const now = keyboard.engine.link(clock);
        stored = now && !high;
        high = now;
      }

      expect(String.fromCharCode(...read)).toBe(text);
    }
  );
});
