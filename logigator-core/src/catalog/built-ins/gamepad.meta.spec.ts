import { describe, expect, it } from 'vitest';
import { defaultOptionValues } from '../option-schema';
import { validateOptionValue } from '../validate-option-value';
import {
  GAMEPAD_CONTROLS,
  GAMEPAD_DEFAULT_LABELS,
  GAMEPAD_GLYPH_COLUMN_WIDTH,
  GamepadGroupValues,
  gamepadControls,
  gamepadGroups,
  gamepadLabelColumnWidth,
  gamepadMeta
} from './gamepad.meta';

const listed = (key: 'face' | 'shoulders' | 'menu') =>
  gamepadMeta.options[key].values.map((v) => v.value);

const ALL_COMBINATIONS: (GamepadGroupValues & { label: string })[] = listed(
  'face'
).flatMap((face) =>
  listed('shoulders').flatMap((shoulders) =>
    listed('menu').map((menu) => ({ face, shoulders, menu, label: '' }))
  )
);

describe('gamepadMeta', () => {
  it('offers 24 distinct control sets', () => {
    const sets = ALL_COMBINATIONS.map((o) => gamepadControls(o).join());
    expect(new Set(sets).size).toBe(24);
  });

  for (const options of ALL_COMBINATIONS) {
    const name = `face ${options.face}, shoulders ${options.shoulders}, menu ${options.menu}`;

    it(`keeps ports, labels, body and groups in step with the controls (${name})`, () => {
      const controls = gamepadControls(options);

      // Canonical order with groups removed: every control appears at most
      // once and after the one before it.
      const positions = controls.map((c) => GAMEPAD_CONTROLS.indexOf(c));
      expect(
        positions.every((p, i) => p >= 0 && p > (positions[i - 1] ?? -1))
      ).toBe(true);
      expect(controls.slice(0, 4)).toEqual(['up', 'down', 'left', 'right']);

      expect(gamepadMeta.ports(options)).toEqual({
        inputs: 0,
        outputs: controls.length
      });
      expect(gamepadMeta.labels(options).outputs).toEqual(
        controls.map((c) => GAMEPAD_DEFAULT_LABELS[c])
      );
      expect(gamepadMeta.body(options).height).toBe(controls.length);

      // The groups tile the port rows without gap or overlap.
      const groups = gamepadGroups(options);
      expect(groups.flatMap((g) => g.controls)).toEqual(controls);
      groups.forEach((group, i) => {
        expect(group.start).toBe(i === 0 ? 0 : groups[i - 1].end);
        expect(group.end - group.start).toBe(group.controls.length);
      });
      expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length);
    });
  }

  it('defaults to the NES set and tops out at the SNES set', () => {
    const defaults = defaultOptionValues(
      gamepadMeta.options
    ) as unknown as GamepadGroupValues;
    expect(gamepadControls(defaults)).toEqual([
      'up',
      'down',
      'left',
      'right',
      'a',
      'b',
      'select',
      'start'
    ]);
    expect(gamepadControls({ face: 4, shoulders: 2, menu: 2 })).toEqual(
      GAMEPAD_CONTROLS
    );
  });

  it('keeps Start, not Select, when a single menu button is chosen', () => {
    expect(gamepadControls({ face: 0, shoulders: 0, menu: 1 }).at(-1)).toBe(
      'start'
    );
    expect(gamepadControls({ face: 0, shoulders: 0, menu: 1 })).not.toContain(
      'select'
    );
  });

  it('accepts exactly the listed group sizes', () => {
    const { face, shoulders, menu } = gamepadMeta.options;
    for (const value of [0, 1, 2, 4]) {
      expect(validateOptionValue(face, value)).toBeNull();
    }
    expect(validateOptionValue(face, 3)).not.toBeNull();
    expect(validateOptionValue(shoulders, 1)).not.toBeNull();
    expect(validateOptionValue(menu, 3)).not.toBeNull();
  });

  it('widens the body with the default labels it draws', () => {
    // Every default label fits the narrowest label column.
    for (const options of ALL_COMBINATIONS) {
      expect(gamepadMeta.body(options).width).toBe(
        GAMEPAD_GLYPH_COLUMN_WIDTH + 1
      );
    }
  });
});

describe('gamepadLabelColumnWidth', () => {
  it('steps at 2, 5 and 8 characters', () => {
    const widthFor = (length: number) =>
      gamepadLabelColumnWidth(['A', 'x'.repeat(length), 'ST']);
    expect([1, 2, 3, 5, 6, 8].map(widthFor)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
