export interface ElementType {
	name: string;
	numInputs: number;
	numOutputs: number;
	hasVariableInputs: boolean;
	symbol: string;
	description: string;
	rotation: number;
	category: 'basic' | 'io' | 'user';
}
