import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

export const button: ElementType = {
	id: ElementTypeId.BUTTON,

	name: 'ELEMENT_TYPE.IO.BUTTON.NAME',

	category: 'io',

	symbol: 'but',
	symbolImage: 'assets/elements/button.svg',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.BUTTON.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width: () => 1,
	height: () => 1
};
