import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

export const ram: ElementType = {
	id: ElementTypeId.RAM,

	name: 'ELEMENT_TYPE.ADVANCED.RAM.NAME',

	category: 'advanced',

	symbol: 'RAM',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.RAM.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 4,

	numInputs: 10,

	// to disable input element
	minInputs: 0,
	maxInputs: 0,

	width: () => 3,
	height(element?) {
		return element ? Math.max(element.numInputs, element.numOutputs) : Math.max(this.numInputs, this.numOutputs);
	},

	options: [4, 4],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.ADVANCED.RAM.WORD_SIZE',
			min: 1,
			max: 64
		},
		{
			name: 'ELEMENT_TYPE.ADVANCED.RAM.ADDRESS_SIZE',
			min: 1,
			max: 16
		}
	],
	onOptionsChanged(element?) {
		if (!element)
			element = this;

		element.numInputs = element.options[0] + element.options[1] + 2;
		element.numOutputs = element.options[0];
	},

	calcLabels(element?)  {
		if (!element)
			element = this;

		const labels = [];

		for (let i = 0; i < element.options[1]; i++) {
			labels.push('A' + i);
		}
		for (let i = 0; i < element.options[0]; i++) {
			labels.push('D' + i);
		}
		labels.push('WE', 'CLK');
		for (let i = 0; i < element.options[0]; i++) {
			labels.push('D' + i);
		}

		return labels;
	}
};
