import { ComponentType } from './component-type.enum';

export interface SerializedComponent {
	/** Component type */
	t: ComponentType;

	/** Grid Position */
	p: [number, number];

	/** Option Values */
	o: unknown[]; // .value
}
