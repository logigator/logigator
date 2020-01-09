import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const led: ElementType = {
	id: ElementTypeId.LED,

	name: 'ELEMENT_TYPE.IO.LED.NAME',

	category: 'io',

	symbol: 'LED',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.LED.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 0,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: 1,
};
