import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const led: ElementType = {
	id: ElementTypeId.LED,

	name: 'ELEMENT_TYPE.IO.LED.NAME',

	category: 'io',

	symbol: 'LED',
	symbolImage: 'assets/elements/led.svg',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.LED.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 0,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: () => 1,
	height: () => 1
};
