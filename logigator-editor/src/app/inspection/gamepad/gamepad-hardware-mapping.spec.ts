import { describe, expect, it } from 'vitest';
import {
  controllerLabel,
  GamepadInputs,
  standardHolds
} from './gamepad-hardware-mapping';

/** A standard-mapped controller at rest, with the given buttons and axes set. */
function pad(
  pressed: readonly number[] = [],
  values: Readonly<Record<number, number>> = {},
  axes: readonly number[] = [0, 0, 0, 0]
): GamepadInputs {
  return {
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: values[i] ?? (pressed.includes(i) ? 1 : 0)
    })),
    axes
  };
}

describe('standardHolds', () => {
  it('maps every standard button onto its control, face buttons by SNES position', () => {
    const holds = standardHolds(pad([12, 13, 14, 15, 1, 0, 3, 2, 4, 5, 8, 9]));

    expect(Object.fromEntries(holds)).toEqual({
      'button-12': 'up',
      'button-13': 'down',
      'button-14': 'left',
      'button-15': 'right',
      'button-1': 'a',
      'button-0': 'b',
      'button-3': 'x',
      'button-2': 'y',
      'button-4': 'l',
      'button-5': 'r',
      'button-8': 'select',
      'button-9': 'start'
    });
  });

  it('holds nothing for the buttons outside the mapping', () => {
    // 10/11 are the stick clicks, 16 the home button.
    expect(standardHolds(pad([10, 11, 16])).size).toBe(0);
  });

  it('holds l and r from the triggers only past half travel, whatever pressed says', () => {
    expect(standardHolds(pad([6], { 6: 0.5 })).size).toBe(0);
    expect(
      Object.fromEntries(standardHolds(pad([], { 6: 0.51, 7: 0.9 })))
    ).toEqual({
      'button-6': 'l',
      'button-7': 'r'
    });
  });

  it('keeps a bumper and its trigger as two holders of one control', () => {
    const holds = standardHolds(pad([4], { 6: 1 }));
    expect([...holds]).toEqual([
      ['button-4', 'l'],
      ['button-6', 'l']
    ]);
  });

  it('reads the left stick past 0.5 as directions beside the D-pad', () => {
    expect(standardHolds(pad([], {}, [0.5, -0.5])).size).toBe(0);

    const diagonal = standardHolds(pad([12], {}, [0.8, -0.9, 0, 0]));
    expect(Object.fromEntries(diagonal)).toEqual({
      'button-12': 'up',
      'stick-up': 'up',
      'stick-right': 'right'
    });

    const downLeft = standardHolds(pad([], {}, [-0.7, 0.7]));
    expect(Object.fromEntries(downLeft)).toEqual({
      'stick-down': 'down',
      'stick-left': 'left'
    });
  });

  it('ignores the right stick', () => {
    expect(standardHolds(pad([], {}, [0, 0, 1, -1])).size).toBe(0);
  });
});

describe('controllerLabel', () => {
  it('drops the mapping and vendor/product suffix Chromium appends', () => {
    expect(
      controllerLabel(
        0,
        'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)'
      )
    ).toBe('1 · Xbox Wireless Controller');
    expect(
      controllerLabel(1, 'Xbox 360 Controller (XInput STANDARD GAMEPAD)')
    ).toBe('2 · Xbox 360 Controller');
  });

  it('drops the vendor-product prefix Firefox puts in front', () => {
    expect(controllerLabel(2, '054c-09cc-Wireless Controller')).toBe(
      '3 · Wireless Controller'
    );
  });

  it('keeps a name that carries no noise, and parentheses that are part of it', () => {
    expect(controllerLabel(0, 'Pro Controller')).toBe('1 · Pro Controller');
    expect(controllerLabel(0, '8BitDo SN30 Pro (Bluetooth)')).toBe(
      '1 · 8BitDo SN30 Pro (Bluetooth)'
    );
  });

  it('falls back to the raw id when stripping would leave nothing', () => {
    expect(controllerLabel(0, '(Vendor: 1234 Product: 5678)')).toBe(
      '1 · (Vendor: 1234 Product: 5678)'
    );
  });
});
