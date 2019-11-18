import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const and: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.AND.NAME',

	category: 'basic',

	symbol: '&',

	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.AND.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 64,

	width: environment.componentWidth
};
