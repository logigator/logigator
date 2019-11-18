import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const clock: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.CLOCK.NAME',

	category: 'basic',

	symbol: 'clk',

	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.CLOCK.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: environment.componentWidth
};
