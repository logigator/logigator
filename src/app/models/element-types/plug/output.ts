import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const output: ElementType = {
	id: ElementTypeId.OUTPUT,

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
	hasLabel: true,

	width: 1,
};
