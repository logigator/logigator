import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

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
		if (!element)
			element = this;

		element.numOutputs = element.options[0];
	},

	width: () => 3,
	height(element?) {
		if (!element)
			element = this;

		const size = Math.max(element.numInputs, element.numOutputs);
		return size < 2 ? 2 : size;
	},

	calcLabels(element?)  {
		if (!element)
			element = this;
		return ['CLK', ...new Array(this.numOutputs).map((x, y) => y + '')];
	}
};
