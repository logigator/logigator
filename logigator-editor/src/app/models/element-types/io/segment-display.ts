import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

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
	rotation: 0,

	numOutputs: 0,

	numInputs: 2,
	minInputs: 1,
	maxInputs: 16,

	width(element?) {
		const inputs = element ? element.numInputs : this.numInputs;
		const rotation = element ? element.rotation : this.rotation;
		if (rotation % 2 === 0) {
			return 2 + Math.ceil(Math.log10((2 ** inputs) + 1));
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
