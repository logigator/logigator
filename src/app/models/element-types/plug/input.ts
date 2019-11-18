import {ElementType} from '../element-type';

export const input: ElementType = {
	name: 'ELEMENT_TYPE.PLUG.INPUT.NAME',

	category: 'plug',

	symbol: 'in',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.PLUG.INPUT.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	hasPlugIndex: true,

	width: 1,
};
