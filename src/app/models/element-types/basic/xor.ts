import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const xor: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.XOR.NAME',

	category: 'basic',

	symbol: '=1',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.XOR.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 64,

	width: environment.componentWidth
};
