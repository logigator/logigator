import { GamepadControlId } from '@logigator/core';

/** The part of a browser `Gamepad` the standard mapping reads. */
export interface GamepadInputs {
  readonly buttons: readonly Pick<GamepadButton, 'pressed' | 'value'>[];
  readonly axes: readonly number[];
}

/**
 * How far a stick axis, or an analogue trigger's value, has to go before it
 * counts as held.
 */
export const ANALOGUE_THRESHOLD = 0.5;

/**
 * The W3C `standard` mapping onto gamepad controls. The face buttons follow
 * the SNES positions (A right, B bottom, X top, Y left), so the layout is the
 * same on every standard controller whatever its labels say.
 */
const DIGITAL_BUTTONS: readonly (readonly [number, GamepadControlId])[] = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
  [1, 'a'],
  [0, 'b'],
  [3, 'x'],
  [2, 'y'],
  [4, 'l'],
  [5, 'r'],
  [8, 'select'],
  [9, 'start']
];

/** The two triggers, whose analogue `value` decides rather than `pressed`. */
const TRIGGERS: readonly (readonly [number, GamepadControlId])[] = [
  [6, 'l'],
  [7, 'r']
];

/**
 * Every control a standard-mapped controller holds right now, keyed by the
 * input holding it: `button-<index>` for a button, `stick-<direction>` for
 * the left stick. Two inputs can hold one control (the D-pad's up and the
 * stick pushed up, a bumper and its trigger), and each is its own entry, so
 * the control stays held until both let go.
 */
export function standardHolds(
  pad: GamepadInputs
): Map<string, GamepadControlId> {
  const holds = new Map<string, GamepadControlId>();
  for (const [index, control] of DIGITAL_BUTTONS) {
    if (pad.buttons[index]?.pressed) holds.set(`button-${index}`, control);
  }
  for (const [index, control] of TRIGGERS) {
    if ((pad.buttons[index]?.value ?? 0) > ANALOGUE_THRESHOLD) {
      holds.set(`button-${index}`, control);
    }
  }
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  if (y < -ANALOGUE_THRESHOLD) holds.set('stick-up', 'up');
  if (y > ANALOGUE_THRESHOLD) holds.set('stick-down', 'down');
  if (x < -ANALOGUE_THRESHOLD) holds.set('stick-left', 'left');
  if (x > ANALOGUE_THRESHOLD) holds.set('stick-right', 'right');
  return holds;
}

/**
 * A browser's controller `id` reduced to the product name: Chromium's
 * parenthesised mapping and vendor/product suffix and Firefox's
 * `vendor-product-` prefix are noise to a reader.
 */
export function controllerName(id: string): string {
  const name = id
    .replace(
      /\s*\([^()]*(?:vendor|product|standard gamepad|xinput)[^()]*\)/gi,
      ''
    )
    .replace(/^[0-9a-f]{1,4}-[0-9a-f]{1,4}-/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return name || id.trim();
}

/** How a controller is listed: its index, from 1, and its name. */
export function controllerLabel(index: number, id: string): string {
  const name = controllerName(id);
  return name ? `${index + 1} · ${name}` : `${index + 1}`;
}
