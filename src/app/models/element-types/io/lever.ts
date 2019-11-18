import {ElementType} from '../element-type';

export const lever: ElementType = {
	name: 'ELEMENT_TYPE.IO.LEVER.NAME',

	category: 'io',

	symbol: 'sw',

	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.LEVER.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width: 1,
};
