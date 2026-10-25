import { describe, expect, it } from 'vitest';
import { dpadDirections, heldChanges } from './dpad-sectors';

/** The directions held at `degrees` clockwise from east, at `distance`. */
function at(degrees: number, distance = 40, radius = 50): readonly string[] {
  const rad = (degrees * Math.PI) / 180;
  return dpadDirections(
    distance * Math.cos(rad),
    distance * Math.sin(rad),
    radius
  );
}

describe('dpadDirections', () => {
  it('holds one direction on an axis and both neighbours on a diagonal', () => {
    expect(at(0)).toEqual(['right']);
    expect(at(90)).toEqual(['down']);
    expect(at(180)).toEqual(['left']);
    expect(at(270)).toEqual(['up']);
    expect(at(45)).toEqual(['down', 'right']);
    expect(at(135)).toEqual(['down', 'left']);
    expect(at(225)).toEqual(['up', 'left']);
    expect(at(315)).toEqual(['up', 'right']);
  });

  it('switches sector halfway between an axis and a diagonal', () => {
    expect(at(-22)).toEqual(['right']);
    expect(at(-23)).toEqual(['up', 'right']);
    expect(at(249)).toEqual(['up']);
    expect(at(246)).toEqual(['up', 'left']);
  });

  it('holds nothing inside the dead zone, and keeps the sector past the rim', () => {
    expect(at(180, 9)).toEqual([]);
    expect(at(45, 0)).toEqual([]);
    expect(at(180, 11)).toEqual(['left']);
    expect(at(180, 500)).toEqual(['left']);
  });
});

describe('heldChanges', () => {
  it('rolling from ← through ↖ to ↑ presses ↑ once and releases ← once', () => {
    const left = at(180);
    const upLeft = at(225);
    const up = at(270);

    expect(heldChanges(left, upLeft)).toEqual({
      pressed: ['up'],
      released: []
    });
    expect(heldChanges(upLeft, up)).toEqual({
      pressed: [],
      released: ['left']
    });
  });

  it('lifting releases everything held and presses nothing', () => {
    expect(heldChanges(at(315), [])).toEqual({
      pressed: [],
      released: ['up', 'right']
    });
  });
});
