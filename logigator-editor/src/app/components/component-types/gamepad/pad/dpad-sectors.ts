/** A D-pad direction; each is one of the pad's controls. */
export type DpadDirection = 'up' | 'down' | 'left' | 'right';

/**
 * The share of the D-pad's radius around its centre that holds nothing, so a
 * thumb resting in the middle presses no direction.
 */
export const DPAD_DEAD_ZONE = 0.2;

/**
 * The eight 45° sectors clockwise from east, in screen orientation (y grows
 * downwards). A diagonal holds both of its neighbours; each entry lists its
 * directions in port order.
 */
const SECTORS: readonly (readonly DpadDirection[])[] = [
  ['right'],
  ['down', 'right'],
  ['down'],
  ['down', 'left'],
  ['left'],
  ['up', 'left'],
  ['up'],
  ['up', 'right']
];

/**
 * The directions a pointer holds at `(dx, dy)` from the D-pad's centre, in
 * the same units as `radius`. Inside the dead zone it holds none. Beyond the
 * radius the sector still decides, so a thumb sliding off the edge keeps
 * holding what it pointed at.
 */
export function dpadDirections(
  dx: number,
  dy: number,
  radius: number,
  deadZone = DPAD_DEAD_ZONE
): readonly DpadDirection[] {
  if (Math.hypot(dx, dy) < deadZone * radius) return [];
  const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return SECTORS[((step % 8) + 8) % 8];
}

/**
 * What moving from holding `before` to holding `after` presses and releases:
 * only the members that differ, so a roll from ← to ↖ presses ↑ alone.
 */
export function heldChanges<T>(
  before: readonly T[],
  after: readonly T[]
): { pressed: T[]; released: T[] } {
  return {
    pressed: after.filter((item) => !before.includes(item)),
    released: before.filter((item) => !after.includes(item))
  };
}
