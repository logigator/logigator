export interface ElementType {
	// translation id for predefined comps
	name: string;
	numInputs: number;
	numOutputs: number;
	maxInputs: number;
	minInputs: number;
	symbol: string;
	// translation id for predefined comps
	description: string;
	rotation: number;
	category: 'basic' | 'plug' | 'io' | 'user';
}
