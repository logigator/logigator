import type { InputWrite } from '@logigator/sim/wasm';
import { BoardDescriptor } from '../compiler/compiled-board.model';

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
   * Frames for the engine's inputs, handed to `submitInput` as they are: the
   * engine queues and sequences them, and refuses the whole request on any
   * error.
   */
  | { kind: 'submitInput'; reqId: number; writes: InputWrite[] }
  /**
   * Starts reading a range of a unit's engine state with every snapshot, or
   * moves the range of a watch already started under the same id.
   */
  | { kind: 'watchState'; reqId: number; watch: StateWatchRequest }
  /** Stops a watch; an id the worker does not hold is ignored. */
  | { kind: 'unwatchState'; reqId: number; id: number }
  /** `full` forces a full snapshot, seeding a fresh watch applier. */
  | { kind: 'requestSnapshot'; reqId: number; full?: boolean }
  | { kind: 'requestStatus'; reqId: number }
  /** Pool refill: hands a transferred snapshot buffer back to the worker. */
  | { kind: 'returnBuffer'; buffer: ArrayBuffer };

/**
 * A byte range of one engine unit's state the main thread watches, under an
 * id of its own: two views of one unit are two watches.
 */
export interface StateWatchRequest {
  id: number;
  /** The unit's board submission index, the engine's component id. */
  unit: number;
  /** The range `[offset, offset + length)` of the unit's state bytes. */
  offset: number;
  length: number;
}

/**
 * A watched range read beside a snapshot, so the bytes belong to the tick the
 * snapshot shows. `bytes` is the engine's own copy, its buffer transferred.
 */
export interface StateRead {
  id: number;
  offset: number;
  bytes: Uint8Array;
}

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
   * `[unit, event frames not yet applied]` for every input holding one,
   * present only when some input's count changed since the last snapshot —
   * an empty list then means none holds one any more.
   */
  inputProgress?: [unit: number, pending: number][];
  /**
   * The watched ranges whose unit's state version moved since each was last
   * sent, or that were started or moved since; absent when there are none.
   */
  state?: StateRead[];
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
