// @ts-strict-ignore
import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const decoder: ElementType = {
	id: ElementTypeId.DECODER,

	name: 'ELEMENT_TYPE.ADVANCED.DECODER.NAME',

	category: 'advanced',

	symbol: 'DEC',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.DECODER.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 4,

	numInputs: 2,

	minInputs: 0,
	maxInputs: 0,

	options: [2],
	optionsConfig: [
		{
			name: 'SETTINGS_INFO.INPUTS',
			min: 1,
			max: 6
		}
	],

	onOptionsChanged(element?) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		if (!element) element = this;

		element.numInputs = element.options[0];
		element.numOutputs = Math.pow(2, element.options[0]);
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
			labels.push(Math.pow(2, i) + '');
		}
		for (let i = 0; i < element.numOutputs; i++) {
			labels.push(i + '');
		}

		return labels;
	}
};
