import { WireDirection } from './wire-direction.enum';

export interface SerializedWire {
  /** Component ID */
  id: number;

  /** Grid Position */
  pos: [number, number];

  direction: WireDirection;

  length: number;
}
