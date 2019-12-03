import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const lever: ElementType = {
	id: ElementTypeId.LEVER,

	name: 'ELEMENT_TYPE.IO.LEVER.NAME',

	category: 'io',

	symbol: 'sw',

	showSettings: true,
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
