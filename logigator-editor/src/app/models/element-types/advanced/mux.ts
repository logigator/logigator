import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

export const mux: ElementType = {
	id: ElementTypeId.MUX,

	name: 'ELEMENT_TYPE.ADVANCED.MUX.NAME',

	category: 'advanced',

	symbol: 'MUX',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.MUX.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 3,

	minInputs: 0,
	maxInputs: 0,

	options: [1],
	optionsConfig: [
		{
			name: 'SETTINGS_INFO.INPUTS',
			min: 1,
			max: 6
		}
	],

	onOptionsChanged(element?) {
		if (!element)
			element = this;

		element.numInputs = element.options[0] + Math.pow(2, element.options[0]);
	},

	width: () => 3,
	height(element?) {
		if (!element)
			element = this;

		return element.numInputs;
	},

	calcLabels(element?)  {
		if (!element)
			element = this;

		const labels = [];
		for (let i = 0; i < element.options[0]; i++) {
			labels.push('S' + i);
		}
		for (let i = 0; i < element.numInputs - element.options[0]; i++) {
			labels.push(i + '');
		}

		return labels;
	}
};
