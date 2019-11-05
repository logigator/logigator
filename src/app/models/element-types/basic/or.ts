import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const or: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.OR.NAME',
	numInputs: 2,
	numOutputs: 1,
	minInputs: 2,
	maxInputs: 64,
	width: environment.componentWidth,
	symbol: '≥1',
	description: 'ELEMENT_TYPE.BASIC.OR.DESCRIPTION',
	rotation: 0,
	category: 'basic'
};
