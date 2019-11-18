import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const delay: ElementType = {
	name: 'ELEMENT_TYPE.BASIC.DELAY.NAME',

	category: 'basic',

	symbol: '1',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.DELAY.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: environment.componentWidth,

	options: [1],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.BASIC.DELAY.DELAY_OPT',
			min: 1,
			max: Number.MAX_VALUE
		}
	]
};
