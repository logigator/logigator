import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const rom: ElementType = {
	id: ElementTypeId.ROM,

	name: 'ELEMENT_TYPE.ADVANCED.ROM.NAME',

	category: 'advanced',

	symbol: 'ROM',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.ROM.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 4,

	numInputs: 4,

	// to disable input element
	minInputs: 0,
	maxInputs: 0,

	width: 3,

	options: [4, 4],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.ADVANCED.ROM.WORD_SIZE',
			min: 1,
			max: 64
		},
		{
			name: 'ELEMENT_TYPE.ADVANCED.ROM.ADDRESS_SIZE',
			min: 1,
			max: 24
		}
	],
	onOptionsChanged(element?) {
		if (element) {
			element.numInputs = element.options[1];
			element.numOutputs = element.options[0];
			return;
		}
		this.numInputs = this.options[1];
		this.numOutputs = this.options[0];
	},

	calcLabels(element?)  {
		const labels = [];
		if (element) {
			for (let i = 0; i < element.options[1]; i++) {
				labels.push('A' + i);
			}
			for (let i = 0; i < element.options[0]; i++) {
				labels.push(i.toString());
			}
			return labels;
		}
		for (let i = 0; i < this.options[1]; i++) {
			labels.push('A' + i);
		}
		for (let i = 0; i < this.options[0]; i++) {
			labels.push(i.toString());
		}
		return labels;
	}
};
