import { beforeEach, describe, expect, it } from 'vitest';
import {
  BitmapText,
  Container,
  Graphics,
  GraphicsContext,
  Point
} from 'pixi.js';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeGamepad } from '../../../../testing/factories';
import {
  Direction,
  GAMEPAD_CONTROLS,
  GAMEPAD_GLYPH_COLUMN_WIDTH,
  gamepadMeta
} from '@logigator/core';
import { Component } from '../../component';
import { monoTextWidth } from '../../../utils/text-fit';
import { PX } from '../../../utils/grid';
import { gamepadComponentConfig } from './gamepad.config';
import { GamepadComponent } from './gamepad.component';

/** Every node of the visual tree, in draw order. */
function flatten(node: Container, out: Container[] = []): Container[] {
  out.push(node);
  for (const child of node.children) {
    flatten(child as Container, out);
  }
  return out;
}

/** What a node draws with: its context (for a Graphics), tint and alpha. */
function looks(pad: GamepadComponent): {
  node: Container;
  context: GraphicsContext | null;
  tint: number;
  alpha: number;
}[] {
  return flatten(pad).map((node) => ({
    node,
    context: node instanceof Graphics ? node.context : null,
    tint: node.tint,
    alpha: node.alpha
  }));
}

describe('GamepadComponent', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('shows a press as one alpha write, swapping no context and rebuilding nothing', () => {
    const pad = makeGamepad({ face: 4, shoulders: 2 });
    const before = looks(pad);
    const slotA = pad.slotIds.indexOf('a');

    pad.setActive(slotA, true);
    const pressed = looks(pad);

    expect(pressed.map((entry) => entry.node)).toEqual(
      before.map((entry) => entry.node)
    );
    expect(pressed.map((entry) => entry.context)).toEqual(
      before.map((entry) => entry.context)
    );
    expect(pressed.map((entry) => entry.tint)).toEqual(
      before.map((entry) => entry.tint)
    );
    const changed = pressed.filter(
      (entry, i) => entry.alpha !== before[i].alpha
    );
    expect(changed).toHaveLength(1);
    expect(changed[0].alpha).toBe(1);

    pad.setActive(pad.slotIds.indexOf('l'), true);
    pad.clearSimState();
    expect(looks(pad).map((entry) => entry.alpha)).toEqual(
      before.map((entry) => entry.alpha)
    );
    expect(pad.slotIds.some((_, slot) => pad.isActive(slot))).toBe(false);
    pad.destroy({ children: true });
  });

  it('keeps a pressed control shown across a rotation and an option rebuild', () => {
    const pad = makeGamepad({ face: 4 });
    const slotA = pad.slotIds.indexOf('a');
    pad.setActive(slotA, true);

    // A rebuild must show exactly what pressing the same slot on a fresh
    // build of the same shape shows.
    const expectShownAsPressed = (shape: () => GamepadComponent) => {
      const fresh = shape();
      fresh.setActive(slotA, true);
      expect(pad.isActive(slotA)).toBe(true);
      expect(looks(pad).map((entry) => entry.alpha)).toEqual(
        looks(fresh).map((entry) => entry.alpha)
      );
      fresh.destroy({ children: true });
    };

    pad.direction = Direction.S;
    expectShownAsPressed(() => {
      const fresh = makeGamepad({ face: 4 });
      fresh.direction = Direction.S;
      return fresh;
    });

    // Shoulders append ports after the face buttons, so `a` keeps its slot.
    pad.options.shoulders.value = 2;
    expect(pad.slotIds.indexOf('a')).toBe(slotA);
    expectShownAsPressed(() => {
      const fresh = makeGamepad({ face: 4, shoulders: 2 });
      fresh.direction = Direction.S;
      return fresh;
    });
    pad.destroy({ children: true });
  });

  it('fits a name to the label column, shrinking it as far as the smallest label size', () => {
    // The base's smallest label size: 0.25 grid units in pixels.
    const floor = 0.25 / PX;
    const fullSize = (pad: GamepadComponent) =>
      flatten(pad).find((node) => node instanceof BitmapText)!.style.fontSize;
    const defaultSize = fullSize(makeGamepad());

    for (let length = 1; length <= 8; length++) {
      const names = Object.fromEntries(
        GAMEPAD_CONTROLS.map((control) => [control, 'x'.repeat(length)])
      );
      const values = { face: 4, shoulders: 2, menu: 2, names };
      const pad = makeGamepad(values);
      const width = gamepadMeta.body(values).width;

      for (const direction of [Direction.E, Direction.W]) {
        pad.direction = direction;
        const labels = flatten(pad).filter(
          (node): node is BitmapText => node instanceof BitmapText
        );
        expect(labels).toHaveLength(GAMEPAD_CONTROLS.length);
        for (const label of labels) {
          // The label's x extent in the unrotated body frame, where the glyph
          // column spans x 0..3 and the label column the rest. Canvas text is
          // monospaced, so its width is arithmetic rather than a measurement.
          const size = label.style.fontSize;
          const w = monoTextWidth(label.text, size);
          const xs = [
            pad.toLocal(new Point(-label.anchor.x * w, 0), label).x,
            pad.toLocal(new Point((1 - label.anchor.x) * w, 0), label).x
          ];
          const inColumn =
            Math.min(...xs) >= GAMEPAD_GLYPH_COLUMN_WIDTH &&
            Math.max(...xs) <= width;

          if (length <= 3) {
            expect(size).toBe(defaultSize);
            expect(inColumn).toBe(true);
          } else {
            // Shrunk to the column, or as small as a label gets.
            expect(size).toBeLessThan(defaultSize);
            expect(inColumn || size === floor).toBe(true);
          }
        }
      }
      pad.destroy({ children: true });
    }
  });

  it('offers names for exactly the controls its own options switch on, on every clone', () => {
    const pad = makeGamepad({ face: 1, menu: 0 });
    const clone = Component.deserialize(
      { ...Component.serialize(pad), id: undefined },
      gamepadComponentConfig
    ) as GamepadComponent;

    clone.options.face.value = 4;
    clone.options.shoulders.value = 2;

    expect(pad.options.names.visibleKeys()).toEqual([
      'up',
      'down',
      'left',
      'right',
      'a'
    ]);
    expect(clone.options.names.visibleKeys()).toEqual(clone.slotIds);
    expect(clone.options.names.visibleKeys()).toHaveLength(10);
    pad.destroy({ children: true });
    clone.destroy({ children: true });
  });
});
