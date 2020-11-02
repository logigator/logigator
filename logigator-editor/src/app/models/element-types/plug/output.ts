import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

export const output: ElementType = {
	id: ElementTypeId.OUTPUT,

	name: 'ELEMENT_TYPE.PLUG.OUTPUT.NAME',

	category: 'plug',

	symbol: 'out',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.PLUG.OUTPUT.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 0,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	hasPlugIndex: true,
	hasLabel: true,

	width: () => 1,
	height: () => 1
};
