import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const encoder: ElementType = {
	id: ElementTypeId.ENCODER,

	name: 'ELEMENT_TYPE.ADVANCED.ENCODER.NAME',

	category: 'advanced',

	symbol: 'ENC',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.ENCODER.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 2,

	minInputs: 0,
	maxInputs: 0,

	options: [1],
	optionsConfig: [
		{
			name: 'SETTINGS_INFO.OUTPUTS',
			min: 1,
			max: 6
		}
	],

	onOptionsChanged(element?) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		if (!element) element = this;

		element.numOutputs = element.options[0];
		element.numInputs = Math.pow(2, element.options[0]);
	},

	width: () => 3,
	height(element?) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		if (!element) element = this;

		const size = Math.max(element.numInputs, element.numOutputs);
		return size < 2 ? 2 : size;
	},

	calcLabels(element?) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		if (!element) element = this;

		const labels = [];
		for (let i = 0; i < element.numInputs; i++) {
			labels.push(i + '');
		}
		for (let i = 0; i < element.numOutputs; i++) {
			labels.push(Math.pow(2, i) + '');
		}

		return labels;
	}
};
