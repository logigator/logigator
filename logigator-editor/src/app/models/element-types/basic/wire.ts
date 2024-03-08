// @ts-strict-ignore
import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const wire: ElementType = {
	id: ElementTypeId.WIRE,

	name: 'wire',

	category: 'basic',

	symbol: '',

	showSettings: false,
	showSettingsForType: false,
	showInConstructionBox: false,

	description: '',

	rotation: ElementRotation.Right,

	numOutputs: 0,

	numInputs: 0,
	minInputs: 0,
	maxInputs: 0,

	width: () => undefined,
	height: () => undefined
};
