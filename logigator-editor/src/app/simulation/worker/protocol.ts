import { BoardDescriptor } from '../compiler/compiled-board.model';

// The WASM package exports `InputEvent`/`SimState` as types only (no runtime
// values), so the wire values live here.
/** Set-and-hold input event (switchComp). */
export const INPUT_EVENT_CONT = 0;
/** One-tick pulse input event (pulse button). */
export const INPUT_EVENT_PULSE = 1;
export type InputEventKind = typeof INPUT_EVENT_CONT | typeof INPUT_EVENT_PULSE;

/** One engine write: the unit, how its state is applied, and the state. */
export type UnitWrite = [unit: number, event: InputEventKind, state: boolean];

/**
 * An input frame with its slots resolved to engine units: writes the worker
 * applies at one tick boundary, with no tick between them. An `event` frame
 * is on the outputs for at least one tick before the next frame of its queue
 * applies; a `state` frame merges into the queue's last frame while that one
 * is a `state` frame not yet applied. `counted` marks a frame the queue's
 * remainder in snapshots counts.
 */
export interface UnitFrame {
  kind: 'state' | 'event';
  units: UnitWrite[];
  counted: boolean;
}

/**
 * Worker-paced run modes. Sync-to-frame is not one: the bridge drives it with
 * one `step` per rendered frame, so the worker stays idle between messages.
 */
export type RunRequest =
  { mode: 'continuous' } | { mode: 'target'; hz: number };

export type MainToWorkerMessage =
  /** Build the simulation; the descriptor is kept for `stop` rebuilds. */
  | { kind: 'init'; reqId: number; descriptor: BoardDescriptor }
  | { kind: 'start'; reqId: number; config: RunRequest }
  /** Interrupt the current run; simulation state is kept. */
  | { kind: 'pause'; reqId: number }
  /** One deterministic tick. */
  | { kind: 'step'; reqId: number }
  /** Destroy and rebuild from the kept descriptor; the engine has no reset. */
  | { kind: 'stop'; reqId: number }
  /**
   * Appends frames to one input's queue, keyed by the input's first unit;
   * each applies at a tick boundary of its own.
   */
  | { kind: 'queueFrames'; reqId: number; queue: number; frames: UnitFrame[] }
  /** Drops one input's queued frames and applies `reset` at once. */
  | { kind: 'clearFrames'; reqId: number; queue: number; reset: UnitWrite[] }
  /** `full` forces a full snapshot, seeding a fresh watch applier. */
  | { kind: 'requestSnapshot'; reqId: number; full?: boolean }
  | { kind: 'requestStatus'; reqId: number }
  /** Pool refill: hands a transferred snapshot buffer back to the worker. */
  | { kind: 'returnBuffer'; buffer: ArrayBuffer };

export interface SnapshotMessage {
  kind: 'snapshot';
  reqId: number;
  tick: number;
  isDelta: boolean;
  /** Byte length of the changed-id `u32` array; `0` for full snapshots. */
  idsByteLength: number;
  /**
   * Delta: packed changed-link values (bit `i` ↔ id `i`). Full: packed link
   * bits (byte `l>>3`, bit `l&7`).
   */
  valuesByteLength: number;
  /** Transferred payload: ids at offset 0, values right after. */
  buffer: ArrayBuffer;
  /**
   * `[queue, counted frames not yet applied]` for every queue holding one;
   * absent while none does.
   */
  queues?: [queue: number, counted: number][];
}

export type WorkerToMainMessage =
  /** WASM module initialized; the worker accepts requests now. */
  | { kind: 'ready' }
  | { kind: 'ok'; reqId: number }
  | {
      kind: 'error';
      reqId: number | null;
      message: string;
      /**
       * Set when the failure has a translatable main-thread message; `message`
       * then carries the raw detail. The worker cannot translate.
       */
      code?: 'engineInitFailed';
    }
  | SnapshotMessage
  | {
      kind: 'status';
      reqId: number;
      tick: number;
      componentCount: number;
      linkCount: number;
    };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/** A correlated main→worker request, before the bridge assigns its `reqId`. */
export type MainRequest = DistributiveOmit<
  Extract<MainToWorkerMessage, { reqId: number }>,
  'reqId'
>;

export interface PackedSnapshot {
  buffer: ArrayBuffer;
  idsByteLength: number;
  valuesByteLength: number;
}

/**
 * Copies a snapshot's bytes into `pool` (reused when large enough): ids at
 * offset 0, values right after. `ids` are the raw bytes of the changed-id
 * `u32` array, `null` for full snapshots. Copying is mandatory — the source
 * views point into WASM linear memory and are valid only until the next tick.
 */
export function packSnapshot(
  pool: ArrayBuffer | undefined,
  ids: Uint8Array | null,
  values: Uint8Array
): PackedSnapshot {
  const idsByteLength = ids?.byteLength ?? 0;
  const needed = idsByteLength + values.byteLength;
  const buffer =
    pool !== undefined && pool.byteLength >= needed
      ? pool
      : new ArrayBuffer(needed);
  const target = new Uint8Array(buffer);
  if (ids) {
    target.set(ids, 0);
  }
  target.set(values, idsByteLength);
  return { buffer, idsByteLength, valuesByteLength: values.byteLength };
}

/**
 * Views into a snapshot message's transferred buffer. `ids` is `null` for full
 * snapshots; the id offset is 0, so the `u32` view is always aligned.
 */
export function unpackSnapshot(msg: SnapshotMessage): {
  ids: Uint32Array | null;
  values: Uint8Array;
} {
  return {
    ids:
      msg.idsByteLength > 0
        ? new Uint32Array(msg.buffer, 0, msg.idsByteLength / 4)
        : null,
    values: new Uint8Array(msg.buffer, msg.idsByteLength, msg.valuesByteLength)
  };
}
