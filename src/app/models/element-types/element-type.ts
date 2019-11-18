import {Project} from '../project';

export interface ElementType {
	// translation id for predefined comps
	name: string;

	category: 'basic' | 'advanced' | 'plug' | 'io' | 'user';

	symbol: string;

	showSettingsForType: boolean;
	showInConstructionBox: boolean;

	// translation id for predefined comps
	description: string;

	isRotatable?: boolean;
	rotation: number;

	numOutputs: number;

	numInputs: number;
	minInputs: number;
	maxInputs: number;

	hasPlugIndex?: boolean;

	width: number;

	options?: number[];
	optionsConfig?: {
		name: string,
		min: number,
		max: number
	}[];

	// if editing type project and id is not passed
	edit?: (typeId: number, id: number, project?: Project) => void;
}

export function isElementType(object: any): object is ElementType {
	return 'name' in object &&
		'numInputs' in object &&
		'numOutputs' in object &&
		'maxInputs' in object &&
		'minInputs' in object &&
		'symbol' in object &&
		'description' in object &&
		'rotation' in object &&
		'category' in object;
}
