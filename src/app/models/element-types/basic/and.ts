import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const and: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.AND.NAME',
	numInputs: 2,
	numOutputs: 1,
	minInputs: 2,
	maxInputs: 64,
	width: environment.componentWidth,
	symbol: '&',
	description: 'ELEMENT_TYPE.BASIC.AND.DESCRIPTION',
	rotation: 0,
	category: 'basic'
};
