import { Component } from './component';

/**
 * The members every user input shares. A component the user drives during
 * simulation has one or more **slots**: slot `i` is output port `i`, driven by
 * its own engine unit, so `inputSlots` equals the output count. Every slot
 * shares the component's `drive` (what the engine receives) and `gesture`
 * (how a pointer on the canvas or in a watch operates it). A slot's active
 * state (high, or flashing for a pulse) is transient sim visuals on the
 * instance — not an option: it is not undoable and not persisted, and
 * `clearSimState()` resets every slot.
 */
interface UserInputBase {
  /** How many slots the input has; one per output port. */
  readonly inputSlots: number;
  /** A stable id per slot, in slot order, for addressing one by name. */
  readonly slotIds?: readonly string[];
  isActive(slot: number): boolean;
  /** Visual only: the engine unit is the simulation service's to drive. */
  setActive(slot: number, active: boolean): void;
}

/**
 * A slot whose unit holds a state until the next one: `hold` is high from
 * press to release, `toggle` flips on a tap.
 */
export interface LevelUserInput extends UserInputBase {
  readonly drive: 'level';
  readonly gesture: 'hold' | 'toggle';
}

/** A slot that sends a one-tick pulse on a tap. */
export interface PulseUserInput extends UserInputBase {
  readonly drive: 'pulse';
  readonly gesture: 'tap';
}

/** Only these drive/gesture pairs exist. */
export type UserInput = LevelUserInput | PulseUserInput;
export type UserInputDrive = UserInput['drive'];
export type UserInputGesture = UserInput['gesture'];

export function isUserInput(
  component: Component
): component is Component & UserInput {
  const candidate = component as Partial<LevelUserInput | PulseUserInput>;
  const validPair =
    candidate.drive === 'level'
      ? candidate.gesture === 'hold' || candidate.gesture === 'toggle'
      : candidate.drive === 'pulse' && candidate.gesture === 'tap';
  return (
    validPair &&
    typeof candidate.inputSlots === 'number' &&
    typeof candidate.isActive === 'function' &&
    typeof candidate.setActive === 'function'
  );
}
