import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const lever: ElementType = {
	id: ElementTypeId.LEVER,

	name: 'ELEMENT_TYPE.IO.LEVER.NAME',

	category: 'io',

	symbol: 'sw',
	symbolImage: 'assets/elements/switch.svg',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.LEVER.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width: () => 1,
	height: () => 1
};
