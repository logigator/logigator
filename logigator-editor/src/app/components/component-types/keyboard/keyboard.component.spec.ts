import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BitmapText, Container, Graphics, GraphicsContext } from 'pixi.js';
import {
  Direction,
  KEYBOARD_DATA_BITS,
  KEYBOARD_STROBE_OUTPUT,
  keyboardMeta
} from '@logigator/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeKeyboard } from '../../../../testing/factories';
import { KeyboardComponent } from './keyboard.component';

/** Every node of the visual tree, in draw order. */
function flatten(node: Container, out: Container[] = []): Container[] {
  out.push(node);
  for (const child of node.children) {
    flatten(child as Container, out);
  }
  return out;
}

const PORT_LABELS = new Set(keyboardMeta.labels().outputs);

/** The one text that is not a port label. */
function readoutOf(keyboard: KeyboardComponent): BitmapText {
  const texts = flatten(keyboard).filter(
    (node): node is BitmapText =>
      node instanceof BitmapText && !PORT_LABELS.has(node.text)
  );
  expect(texts).toHaveLength(1);
  return texts[0];
}

/**
 * Powers the data outputs as the engine does for `code`: a negated output's
 * link carries the inverse of the bit its unit sends.
 */
function send(keyboard: KeyboardComponent, code: number): void {
  for (let bit = 0; bit < KEYBOARD_DATA_BITS; bit++) {
    const high = ((code >> bit) & 1) === 1;
    keyboard.setPortPowered(bit, high !== keyboard.isPortNegated('out', bit));
  }
}

describe('KeyboardComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('shows the code the keyboard sends, each output read ahead of its bubble', () => {
    const keyboard = makeKeyboard();
    keyboard.setPortNegated('out', 0, true);
    keyboard.setPortNegated('out', 5, true);
    // At rest nothing is powered and no bubble inverts.
    expect(readoutOf(keyboard).text).toBe('');

    keyboard.setSimulating(true);
    send(keyboard, 0);
    expect(readoutOf(keyboard).text).toBe('');
    send(keyboard, 0x41);
    expect(readoutOf(keyboard).text).toBe('A');
    send(keyboard, 0x0a);
    expect(readoutOf(keyboard).text).toBe('LF');

    // The exit: links unpowered, then the session left.
    keyboard.clearPortPower();
    keyboard.clearSimState();
    keyboard.setSimulating(false);
    expect(readoutOf(keyboard).text).toBe('');
    keyboard.destroy({ children: true });
  });

  it('assigns the readout text only when the code changes', () => {
    const keyboard = makeKeyboard();
    keyboard.setSimulating(true);
    send(keyboard, 0x41);
    const readout = readoutOf(keyboard);
    const assign = vi.spyOn(readout, 'text', 'set');

    // The same code again, and the strobe, change nothing on D.
    send(keyboard, 0x41);
    keyboard.setPortPowered(KEYBOARD_STROBE_OUTPUT, true);
    keyboard.setPortPowered(KEYBOARD_STROBE_OUTPUT, false);
    expect(assign).not.toHaveBeenCalled();

    // One data link flipping is one new code.
    keyboard.setPortPowered(1, true);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenLastCalledWith('C');
    keyboard.destroy({ children: true });
  });

  it('lights the box by alpha alone, swapping no context and rebuilding nothing', () => {
    const keyboard = makeKeyboard();
    keyboard.setSimulating(true);
    const looks = () =>
      flatten(keyboard).map((node) => ({
        node,
        context: node instanceof Graphics ? node.context : null,
        tint: node.tint,
        alpha: node.alpha
      }));
    const empty = looks();

    send(keyboard, 0x7f);
    const lit = looks();

    expect(lit.map((entry) => entry.node)).toEqual(
      empty.map((entry) => entry.node)
    );
    expect(lit.map((entry) => entry.context)).toEqual(
      empty.map((entry) => entry.context)
    );
    expect(lit.map((entry) => entry.tint)).toEqual(
      empty.map((entry) => entry.tint)
    );
    const relit = lit.filter((entry, i) => entry.alpha !== empty[i].alpha);
    expect(relit.length).toBeGreaterThan(0);
    expect(relit.every((entry) => entry.node instanceof Graphics)).toBe(true);
    expect(
      relit.every((entry) => entry.context instanceof GraphicsContext)
    ).toBe(true);

    send(keyboard, 0);
    expect(looks().map((entry) => entry.alpha)).toEqual(
      empty.map((entry) => entry.alpha)
    );
    keyboard.destroy({ children: true });
  });

  it('keeps the readout upright and the code shown across a rotation', () => {
    const keyboard = makeKeyboard();
    keyboard.setSimulating(true);
    send(keyboard, 0x09);
    for (const direction of [Direction.S, Direction.W, Direction.N]) {
      keyboard.direction = direction;
      const readout = readoutOf(keyboard);
      expect(readout.text).toBe('TAB');
      expect(keyboard.rotation + readout.rotation).toBeCloseTo(0);
    }
    keyboard.destroy({ children: true });
  });
});
