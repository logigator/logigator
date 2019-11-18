import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const or: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.OR.NAME',

	category: 'basic',

	symbol: '≥1',

	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.OR.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 64,

	width: environment.componentWidth
};
