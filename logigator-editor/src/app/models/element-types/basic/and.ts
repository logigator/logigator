import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';
import {ElementTypeId} from '../element-type-ids';

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
	rotation: 0,

	numOutputs: 1,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 64,

	width: () => 2,
	height(element?) {
		return element.numInputs || this.numInputs;
	}
};
