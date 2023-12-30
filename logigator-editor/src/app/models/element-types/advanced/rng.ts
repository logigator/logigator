import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const rng: ElementType = {
	id: ElementTypeId.RNG,

	name: 'ELEMENT_TYPE.ADVANCED.RANDOM.NAME',

	category: 'advanced',

	symbol: 'RNG',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.RANDOM.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 1,

	numInputs: 1,

	// to disable input element
	minInputs: 1,
	maxInputs: 1,

	options: [1],

	optionsConfig: [
		{
			name: 'SETTINGS_INFO.OUTPUTS',
			min: 1,
			max: 64
		}
	],

	onOptionsChanged(element?) {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		if (!element) element = this;

		element.numOutputs = element.options[0];
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

		const labels = ['CLK'];
		for (let i = 0; i < element.numOutputs; i++) {
			labels.push(i + '');
		}

		return labels;
	}
};
