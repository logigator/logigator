import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

export const clock: ElementType = {
	id: ElementTypeId.CLOCK,

	name: 'ELEMENT_TYPE.BASIC.CLOCK.NAME',

	category: 'basic',

	symbol: 'clk',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.CLOCK.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: () => 3,
	height: () => 2,

	options: [1],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.BASIC.CLOCK.SPEED',
			min: 1,
			max: Number.MAX_VALUE
		}
	],

	calcLabels: element => {
		return ['STP', 'CLK'];
	}
};
