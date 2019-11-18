import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const not: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.NOT.NAME',

	category: 'basic',

	symbol: '!',

	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.NOT.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: environment.componentWidth
};
