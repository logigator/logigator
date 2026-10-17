import { InputFrame } from '../components/component-inspection';

/**
 * The most event frames a held input — a `hold` slot's input: the button, the
 * gamepad — leaves pending in the engine: one transition, and one press and
 * its release behind it. Odd on purpose: a lone button whose backlog is full
 * has its pins showing what it is about to be set to (the states alternate),
 * so the frame that replaces the backlog is always an edge the circuit sees.
 */
export const HELD_INPUT_BACKLOG = 3;

/** One state per slot; `null` where the pins may show either. */
type PinState = readonly (boolean | null)[];

/**
 * Where a held input's pins can be, as far as its frames say: the state after
 * each of its latest frames, newest first, and last the state before all of
 * them. With `p` frames still pending the pins show entry `p`; with at most
 * `p` pending, any of the entries `0`…`p`.
 */
export class HeldInputHistory {
  private states: PinState[];

  /** `initial`: what the input's pins show before any frame of it is sent. */
  constructor(initial: readonly boolean[]) {
    this.states = [[...initial]];
  }

  /** The state the input's latest frame leaves it in. */
  public get latest(): readonly boolean[] {
    // The newest entry is always a state that was sent whole or derived
    // from one, so it holds no `null`.
    return this.states[0] as readonly boolean[];
  }

  /**
   * Whether the pins may show `value` on `slot` with at most `pending`
   * frames not yet applied. Beyond what the history holds — frames it never
   * saw — the pins may show anything.
   */
  public mayShow(slot: number, value: boolean, pending: number): boolean {
    if (pending >= this.states.length) {
      return true;
    }
    for (let back = 0; back <= pending; back++) {
      const shown = this.states[back][slot];
      if (shown === null || shown === value) {
        return true;
      }
    }
    return false;
  }

  /** Records a frame appended behind the pending ones, leaving `state`. */
  public append(state: readonly boolean[]): void {
    this.states = [state, ...this.states].slice(0, HELD_INPUT_BACKLOG + 1);
  }

  /**
   * Records a `replace` sending `frames` (newest last) while at most
   * `pending` frames were not yet applied: what `frames` follow is the
   * state the pins were in, any of the latest `pending` states or the one
   * before them, `null` where those disagree.
   */
  public replace(
    frames: readonly (readonly boolean[])[],
    pending: number
  ): void {
    const width = this.latest.length;
    const pins = Array.from({ length: width }, (_, slot) => {
      const high = this.mayShow(slot, true, pending);
      const low = this.mayShow(slot, false, pending);
      return high && low ? null : high;
    });
    this.states = [...[...frames].reverse(), pins].slice(
      0,
      HELD_INPUT_BACKLOG + 1
    );
  }
}

/** What one change of a held input submits: its frames, and whether they replace. */
export interface HeldInputWrite {
  readonly frames: InputFrame[];
  readonly replace: boolean;
}

/**
 * How a change to a held input reaches the engine, recording it in `history`.
 * `change` is the input's frame — `true`/`false` for the slots it changes,
 * `null` for the rest — and `pending` the input's event frames not yet
 * applied, **at most** (`SimulationWorkerService.pendingEvents`).
 *
 * Every write is events, so a press and its release both reach the circuit
 * however fast they came, a tap while paused included. While the change fits
 * behind the pending frames within {@link HELD_INPUT_BACKLOG}, it is appended
 * as it is. Otherwise it **replaces** them, as what is held now: the newest
 * state, whole, and ahead of it one frame stepping each slot this change moves
 * through the opposite value where the pins may already show the new one — a
 * release whose press may not have reached the circuit goes out as that press
 * and the release, so the latest click is always seen, and a press whose
 * pins may still be high from an earlier one goes out as a release and the
 * press, so it is always an edge. The presses the replace drops are the
 * older ones.
 *
 * `pending` may count frames the engine has applied since its last report,
 * so a replace can come early. That stays harmless: the leading frame is
 * decided against every state the pins may be in, so it never repeats a
 * press the circuit already saw, and the newest state is always sent; what
 * an early replace drops is what the policy drops, a little sooner.
 */
export function heldInputWrite(
  history: HeldInputHistory,
  change: readonly (boolean | null)[],
  pending: number
): HeldInputWrite {
  const before = history.latest;
  const next = before.map((value, slot) => change[slot] ?? value);
  if (pending + 1 <= HELD_INPUT_BACKLOG) {
    history.append(next);
    return { frames: [{ state: change }], replace: false };
  }
  const lead = next.map((value, slot) =>
    value !== before[slot] && history.mayShow(slot, value, pending)
      ? !value
      : value
  );
  const frames = lead.every((value, slot) => value === next[slot])
    ? [next]
    : [lead, next];
  history.replace(frames, pending);
  return { frames: frames.map((state) => ({ state })), replace: true };
}
