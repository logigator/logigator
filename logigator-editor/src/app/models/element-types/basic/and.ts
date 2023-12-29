import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const and: ElementType = {
	id: ElementTypeId.AND,

	name: 'ELEMENT_TYPE.BASIC.AND.NAME',

	category: 'basic',

	symbol: '&',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.AND.DESCRIPTION',

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
