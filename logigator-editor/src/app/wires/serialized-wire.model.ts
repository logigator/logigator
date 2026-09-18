import { WireDirection } from '@logigator/core';

export interface SerializedWire {
  /** Component ID */
  id: number;

  /** Grid Position */
  pos: [number, number];

  direction: WireDirection;

  length: number;
}
