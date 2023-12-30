import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const demux: ElementType = {
	id: ElementTypeId.DEMUX,

	name: 'ELEMENT_TYPE.ADVANCED.DEMUX.NAME',

	category: 'advanced',

	symbol: 'DEMUX',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.DEMUX.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 2,

	numInputs: 2,

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
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		if (!element) element = this;

		element.numInputs = element.options[0] + 1;
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
		labels.push('I');
		for (let i = 0; i < element.options[0]; i++) {
			labels.push('S' + i);
		}
		for (let i = 0; i < element.numOutputs; i++) {
			labels.push(i + '');
		}

		return labels;
	}
};
