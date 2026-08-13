import { SerializedComponent } from '../components/serialized-component.model';
import { SerializedWire } from '../wires/serialized-wire.model';
import { PortSide } from '../components/component';
import { Direction, WireDirection } from '@logigator/core';

/** A {@link MoveEntry} with its `Point`s flattened to `[x, y]` for JSON. */
export interface SerializedMoveEntry {
  id: number;
  oldPos: [number, number];
  newPos: [number, number];
}

/** A `RotateComponentEntry` with its `Point`s flattened for JSON. */
export interface SerializedRotateComponentEntry extends SerializedMoveEntry {
  oldDirection: Direction;
  newDirection: Direction;
}

/** A `RotateWireEntry` with its `Point`s flattened for JSON. */
export interface SerializedRotateWireEntry extends SerializedMoveEntry {
  oldDirection: WireDirection;
  newDirection: WireDirection;
}

/**
 * JSON-safe, discriminated representation of every {@link Action} subclass,
 * produced by `Action.serialize()` and reconstructed by `deserializeAction`
 * (see `action-codec.ts`). Used only by the debug Project Dump feature — it is
 * not a persistence format for circuits.
 *
 * `ReorderPlugsAction`/`UpdateInstanceAction` extend `ActionContainer`, so they
 * serialize as `container` and rehydrate as a plain container (their do/undo is
 * pure child delegation, so behaviour is identical).
 */
export type SerializedAction =
  | { type: 'addComponents'; components: SerializedComponent[] }
  | { type: 'removeComponents'; components: SerializedComponent[] }
  | { type: 'addWires'; wires: SerializedWire[] }
  | { type: 'removeWires'; wires: SerializedWire[] }
  | { type: 'moveComponents'; entries: SerializedMoveEntry[] }
  | { type: 'moveWires'; entries: SerializedMoveEntry[] }
  | { type: 'rotateComponents'; entries: SerializedRotateComponentEntry[] }
  | { type: 'rotateWires'; entries: SerializedRotateWireEntry[] }
  | {
      type: 'changeOption';
      componentId: number;
      optionKey: string;
      oldValue: unknown;
      newValue: unknown;
    }
  | {
      type: 'togglePortNegation';
      componentId: number;
      side: PortSide;
      index: number;
      negated: boolean;
    }
  | { type: 'container'; actions: SerializedAction[] };
