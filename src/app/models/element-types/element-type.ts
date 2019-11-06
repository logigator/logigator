export interface ElementType {
	// translation id for predefined comps
	name: string;
	numInputs: number;
	numOutputs: number;
	maxInputs: number;
	minInputs: number;
	width: number;
	symbol: string;
	// translation id for predefined comps
	description: string;
	rotation: number;
	category: 'basic' | 'advanced' | 'plug' | 'io' | 'user';
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
