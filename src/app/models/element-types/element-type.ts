export interface ElementType {
	name: string;
	numInputs: number;
	numOutputs: number;
	readonly maxInputs: number;
	readonly minInputs: number;
	symbol: string;
	description: string;
	rotation: number;
	category: 'basic' | 'plug' | 'io' | 'user';
}
