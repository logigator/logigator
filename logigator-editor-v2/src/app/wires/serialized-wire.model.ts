import { WireDirection } from './wire-direction.enum';

export interface SerializedWire {
	/** Component ID */
	id: number;

	/** Grid Position */
	pos: [number, number];

	/** Wire Direction */
	direction: WireDirection;

	/** Wire Length */
	length: number;
}
