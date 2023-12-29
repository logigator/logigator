import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

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
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: () => 2,
	height: () => 1
};
