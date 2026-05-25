import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const butt: ElementType = {
	id: ElementTypeId.BUTT,

	name: 'Butt PLug',

	category: 'plug',

	symbol: '3 -',

	showSettings: true,
	showSettingsForType: false,
	showInConstructionBox: false,

	description: 'Place this in your butt',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width: () => 1,
	height: () => 1
};
