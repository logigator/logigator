import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const fullAdder: ElementType = {
	name: 'ELEMENT_TYPE.ADVANCED.FULL_ADDER.NAME',
	numInputs: 3,
	numOutputs: 2,
	minInputs: 3,
	maxInputs: 3,
	width: environment.componentWidth,
	symbol: 'FA',
	description: 'ELEMENT_TYPE.ADVANCED.FULL_ADDER.DESCRIPTION',
	rotation: 0,
	category: 'advanced'
};
