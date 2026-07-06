import { BoardDescriptor } from '../compiler/compiled-board.model';

// The WASM package exports `InputEvent`/`SimState` as types only (no runtime
// values), so the wire values live here.
/** Set-and-hold input event (switchComp). */
export const INPUT_EVENT_CONT = 0;
/** One-tick pulse input event (button). */
export const INPUT_EVENT_PULSE = 1;
export type InputEventKind = typeof INPUT_EVENT_CONT | typeof INPUT_EVENT_PULSE;

/**
 * Worker-paced run modes. Sync-to-frame is not a worker mode: the bridge
 * drives it with one `step` per rendered frame, so the worker stays idle
 * between messages.
 */
export type RunRequest =
  | { mode: 'continuous' }
  | { mode: 'target'; hz: number };

export type MainToWorkerMessage =
  /** Build the simulation; the descriptor is kept for `stop` rebuilds. */
  | { kind: 'init'; reqId: number; descriptor: BoardDescriptor }
  | { kind: 'start'; reqId: number; config: RunRequest }
  /** Interrupt the current run; simulation state is kept. */
  | { kind: 'pause'; reqId: number }
  /** One deterministic tick. */
  | { kind: 'step'; reqId: number }
  /** Reset: destroy and rebuild from the kept descriptor (the engine has no reset). */
  | { kind: 'stop'; reqId: number }
  | {
      kind: 'triggerInput';
      reqId: number;
      componentIndex: number;
      event: InputEventKind;
      state: boolean[];
    }
  /** `full` forces a full snapshot (seeds a freshly-registered watch applier). */
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
  /** Delta: packed changed-link values (bit `i` ↔ id `i`). Full: packed link bits (byte `l>>3`, bit `l&7`). */
  valuesByteLength: number;
  /** Transferred payload: ids at offset 0, values right after. */
  buffer: ArrayBuffer;
}

export type WorkerToMainMessage =
  /** WASM module initialized; the worker accepts requests now. */
  | { kind: 'ready' }
  | { kind: 'ok'; reqId: number }
  | { kind: 'error'; reqId: number | null; message: string }
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
 * Copies a snapshot's bytes into `pool` (reused when large enough, otherwise
 * a fresh buffer): ids at offset 0, values right after. `ids` are the raw
 * bytes of the changed-id `u32` array; `null` for full snapshots. Copying is
 * mandatory — the source views point into WASM linear memory and are valid
 * only until the next tick.
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
 * Views into a snapshot message's transferred buffer. `ids` is `null` for
 * full snapshots; the id offset is 0, so the `u32` view is always aligned.
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
