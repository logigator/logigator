import { BuiltInComponentType } from '../../model/component-type.enum';
import { ComponentCategory } from '../../model/component-category.enum';
import { ComponentMeta } from '../component-meta';
import { canonicalNameMap, NameMap, SelectOptionValue } from '../option-schema';

/** One logical control of a gamepad; each present control is one output. */
export type GamepadControlId =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'l'
  | 'r'
  | 'select'
  | 'start';

/**
 * Every control in port order. A pad's outputs are this list with its
 * switched-off groups removed, so the rest keep their relative order.
 */
export const GAMEPAD_CONTROLS: readonly GamepadControlId[] = [
  'up',
  'down',
  'left',
  'right',
  'a',
  'b',
  'x',
  'y',
  'l',
  'r',
  'select',
  'start'
];

/** The groups a pad's controls fall into, in port order. */
export type GamepadGroupId = 'dpad' | 'face' | 'shoulders' | 'menu';

/**
 * Each control's default port label, shared by the canvas and the controller
 * window. The D-pad is spelled out rather than drawn as arrows: Roboto Mono,
 * the canvas face, has no arrow glyphs.
 */
export const GAMEPAD_DEFAULT_LABELS: Readonly<
  Record<GamepadControlId, string>
> = {
  up: 'UP',
  down: 'DN',
  left: 'LT',
  right: 'RT',
  a: 'A',
  b: 'B',
  x: 'X',
  y: 'Y',
  l: 'L',
  r: 'R',
  select: 'SL',
  start: 'ST'
};

const DPAD: readonly GamepadControlId[] = ['up', 'down', 'left', 'right'];

/**
 * The controls each value of an optional group's option switches on, keyed by
 * the option value. The option offers exactly these keys.
 */
const FACE_SETS: Readonly<Record<number, readonly GamepadControlId[]>> = {
  0: [],
  1: ['a'],
  2: ['a', 'b'],
  4: ['a', 'b', 'x', 'y']
};
const SHOULDER_SETS: Readonly<Record<number, readonly GamepadControlId[]>> = {
  0: [],
  2: ['l', 'r']
};
// A single menu button is Start, the one a game cannot do without.
const MENU_SETS: Readonly<Record<number, readonly GamepadControlId[]>> = {
  0: [],
  1: ['start'],
  2: ['select', 'start']
};

const GROUP_OF: Readonly<Record<GamepadControlId, GamepadGroupId>> = {
  up: 'dpad',
  down: 'dpad',
  left: 'dpad',
  right: 'dpad',
  a: 'face',
  b: 'face',
  x: 'face',
  y: 'face',
  l: 'shoulders',
  r: 'shoulders',
  select: 'menu',
  start: 'menu'
};

/** The options that decide which controls a pad has. */
export interface GamepadGroupValues {
  face: number;
  shoulders: number;
  menu: number;
}

interface GamepadValues extends GamepadGroupValues {
  names: NameMap;
}

/**
 * The pad's controls in port order: the D-pad, then whichever face, shoulder
 * and menu buttons the options switch on. A value outside an option's list
 * contributes no controls.
 */
export function gamepadControls(
  options: GamepadGroupValues
): GamepadControlId[] {
  return [
    ...DPAD,
    ...(FACE_SETS[options.face] ?? []),
    ...(SHOULDER_SETS[options.shoulders] ?? []),
    ...(MENU_SETS[options.menu] ?? [])
  ];
}

/** One present group and the port rows its controls occupy. */
export interface GamepadGroup {
  readonly id: GamepadGroupId;
  readonly controls: readonly GamepadControlId[];
  /** First port row of the group. */
  readonly start: number;
  /** One past the group's last port row. */
  readonly end: number;
}

/** The present groups in port order, each with its contiguous row range. */
export function gamepadGroups(options: GamepadGroupValues): GamepadGroup[] {
  const groups: GamepadGroup[] = [];
  gamepadControls(options).forEach((control, row) => {
    const id = GROUP_OF[control];
    const last = groups.at(-1);
    if (last?.id === id) {
      groups[groups.length - 1] = {
        ...last,
        controls: [...last.controls, control],
        end: row + 1
      };
    } else {
      groups.push({ id, controls: [control], start: row, end: row + 1 });
    }
  });
  return groups;
}

/** Width of the glyph column every pad draws beside its port labels. */
export const GAMEPAD_GLYPH_COLUMN_WIDTH = 3;

/**
 * Grid cells the label column needs for `labels`, by the longest one: one cell
 * up to 2 characters, two up to 5, three beyond.
 */
export function gamepadLabelColumnWidth(labels: readonly string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return longest <= 2 ? 1 : longest <= 5 ? 2 : 3;
}

/**
 * Each present control's port label: its custom name where one is set,
 * otherwise its default. Names of controls the options switch off stay in the
 * value and are simply not shown.
 */
function portLabels(options: GamepadValues): string[] {
  const names = canonicalNameMap(GAMEPAD_CONTROLS, options.names);
  return gamepadControls(options).map(
    (control) => names[control] ?? GAMEPAD_DEFAULT_LABELS[control]
  );
}

/** One select value per entry of `sets`, labelled by the controls it adds. */
function setValues(
  sets: Readonly<Record<number, readonly GamepadControlId[]>>
): SelectOptionValue<number>[] {
  return Object.entries(sets).map(([value, controls]) => ({
    value: Number(value),
    label:
      controls.length === 0
        ? '0'
        : controls.map((control) => GAMEPAD_DEFAULT_LABELS[control]).join(' ')
  }));
}

/**
 * A controller with one output per button, high while the button is held. The
 * D-pad is always present, so a pad never has fewer than four outputs.
 */
export const gamepadMeta = {
  type: BuiltInComponentType.GAMEPAD,
  category: ComponentCategory.IO,
  symbol: 'PAD',
  name: 'components.def.GAMEPAD.name',
  description: 'components.def.GAMEPAD.description',
  options: {
    face: {
      kind: 'select-button',
      label: 'components.def.GAMEPAD.options.face',
      values: setValues(FACE_SETS),
      default: 2
    },
    shoulders: {
      kind: 'select-button',
      label: 'components.def.GAMEPAD.options.shoulders',
      values: setValues(SHOULDER_SETS),
      default: 0
    },
    menu: {
      kind: 'select-button',
      label: 'components.def.GAMEPAD.options.menu',
      values: setValues(MENU_SETS),
      default: 2
    },
    names: {
      kind: 'name-map',
      label: 'components.def.GAMEPAD.options.names',
      keys: GAMEPAD_CONTROLS,
      maxLength: 8,
      forbiddenChars: ',',
      default: Object.freeze({})
    }
  },
  ports: (o) => ({ inputs: 0, outputs: gamepadControls(o).length }),
  labels: (o) => ({ inputs: [], outputs: portLabels(o) }),
  body: (o) => {
    const labels = portLabels(o);
    return {
      width: GAMEPAD_GLYPH_COLUMN_WIDTH + gamepadLabelColumnWidth(labels),
      height: labels.length
    };
  }
} as const satisfies ComponentMeta<GamepadValues>;
