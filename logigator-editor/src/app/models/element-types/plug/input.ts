import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

export const input: ElementType = {
	id: ElementTypeId.INPUT,

	name: 'ELEMENT_TYPE.PLUG.INPUT.NAME',

	category: 'plug',

	symbol: 'IN',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.PLUG.INPUT.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	hasPlugIndex: true,
	hasLabel: true,

	width: () => 1,
	height: () => 1
};
