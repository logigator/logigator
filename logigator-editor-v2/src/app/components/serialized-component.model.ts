import { ComponentType } from './component-type.enum';

export interface SerializedComponent {
	/** Component ID */
	id: number;

	/** Component type */
	type: ComponentType;

	/** Grid Position */
	pos: [number, number];

	/** Option Values */
	options: unknown[]; // .value
}
