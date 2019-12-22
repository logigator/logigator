import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const input: ElementType = {
	id: ElementTypeId.INPUT,

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
	hasLabel: true,

	width: 1,
};
