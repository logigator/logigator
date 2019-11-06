import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const halfAdder: ElementType = {
	name: 'ELEMENT_TYPE.ADVANCED.HALF_ADDER.NAME',
	numInputs: 2,
	numOutputs: 2,
	minInputs: 2,
	maxInputs: 2,
	width: environment.componentWidth,
	symbol: 'HA',
	description: 'ELEMENT_TYPE.ADVANCED.HALF_ADDER.DESCRIPTION',
	rotation: 0,
	category: 'advanced'
};
