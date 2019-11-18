import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const fullAdder: ElementType = {
	name: 'ELEMENT_TYPE.ADVANCED.FULL_ADDER.NAME',
	category: 'advanced',

	symbol: 'FA',

	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.FULL_ADDER.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 2,

	numInputs: 3,
	minInputs: 3,
	maxInputs: 3,

	width: environment.componentWidth,
};
