import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const delay: ElementType = {
	id: ElementTypeId.DELAY,

	name: 'ELEMENT_TYPE.BASIC.DELAY.NAME',

	category: 'basic',

	symbol: '1',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.DELAY.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: () => 2,
	height: () => 1
};
