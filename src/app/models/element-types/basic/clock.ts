import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const clock: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.CLOCK.NAME',
	numInputs: 1,
	numOutputs: 1,
	minInputs: 1,
	maxInputs: 1,
	width: environment.componentWidth,
	symbol: 'clk',
	description: 'ELEMENT_TYPE.BASIC.CLOCK.DESCRIPTION',
	rotation: 0,
	category: 'basic'
};
