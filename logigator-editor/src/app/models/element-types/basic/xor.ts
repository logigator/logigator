// @ts-strict-ignore
import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const xor: ElementType = {
	id: ElementTypeId.XOR,

	name: 'ELEMENT_TYPE.BASIC.XOR.NAME',

	category: 'basic',

	symbol: '=1',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.XOR.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 64,

	width: () => 2,
	height(element?) {
		return element.numInputs || this.numInputs;
	}
};
