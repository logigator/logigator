import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const segmentDisplay: ElementType = {
	id: ElementTypeId.SEGMENT_DISPLAY,

	name: 'ELEMENT_TYPE.IO.SEGMENT_DISPLAY.NAME',

	category: 'io',

	symbol: 'SEG',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.SEGMENT_DISPLAY.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 0,

	numInputs: 2,
	minInputs: 1,
	maxInputs: 16,

	options: [0],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.IO.SEGMENT_DISPLAY.BASE_LABEL',
			allowedValues: [
				{
					label: 'ELEMENT_TYPE.IO.SEGMENT_DISPLAY.BASE.DEC',
					value: 0
				},
				{
					label: 'ELEMENT_TYPE.IO.SEGMENT_DISPLAY.BASE.HEX',
					value: 1
				},
				{
					label: 'ELEMENT_TYPE.IO.SEGMENT_DISPLAY.BASE.OCT',
					value: 2
				}
			]
		}
	],

	width(element?) {
		const inputs = element ? element.numInputs : this.numInputs;
		const rotation = element ? element.rotation : this.rotation;
		const options = element ? element.options : this.options;

		if (rotation % 2 === 0) {
			switch (options[0]) {
				case 1:
					return 2 + Math.ceil(inputs / 4);
				case 2:
					return 2 + Math.ceil(inputs / 3);
				default:
					return 2 + Math.ceil(Math.log10(2 ** inputs + 1));
			}
		} else {
			return 4;
		}
	},
	height(element?) {
		const inputs = element ? element.numInputs : this.numInputs;
		return inputs >= 3 ? inputs : 3;
	},
	calcLabels(element?) {
		return new Array(element ? element.numInputs : this.numInputs)
			.fill(undefined)
			.map((value, index) => index.toString());
	}
};
