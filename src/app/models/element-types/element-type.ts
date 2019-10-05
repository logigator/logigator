export interface ElementType {
	name: string;
	numInputs: number;
	numOutputs: number;
	maxInputs: number;
	minInputs: number;
	symbol: string;
	description: string;
	rotation: number;
	category: 'basic' | 'plug' | 'io' | 'user';
}
