import {ElementType} from '../element-type';

export const output: ElementType = {
	name: 'ELEMENT_TYPE.PLUG.OUTPUT.NAME',

	category: 'plug',

	symbol: 'out',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.PLUG.OUTPUT.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 0,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	hasPlugIndex: true,

	width: 1,
};
