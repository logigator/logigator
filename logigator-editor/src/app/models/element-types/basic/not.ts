import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';
import {ElementTypeId} from '../element-type-ids';

export const not: ElementType = {
	id: ElementTypeId.NOT,

	name: 'ELEMENT_TYPE.BASIC.NOT.NAME',

	category: 'basic',

	symbol: '!',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.NOT.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: () => 2,
	height: () => 1,
};
