import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const ledMatrix: ElementType = {
	id: ElementTypeId.LED_MATRIX,

	name: 'ELEMENT_TYPE.IO.LED_MATRIX.NAME',

	category: 'io',

	symbol: 'LED_M',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.IO.LED_MATRIX.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 0,

	numInputs: 7,

	// to disable input element
	minInputs: 0,
	maxInputs: 0,

	width(element?) {
		return calcWidthHeight(element?.options ? element.options[0] : this.options[0]);

	},
	height(element?) {
		return calcWidthHeight(element?.options ? element.options[0] : this.options[0]);
	},

	options: [4],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.IO.LED_MATRIX.SIZE',
			allowedValues: [4, 8, 16]
		}
	],
	onOptionsChanged(element?) {
		const size = element ? element.options[0] : this.options[0];

		let inputs: number;
		switch (size) {
			case 4:
				inputs = 7;
				break;
			case 8:
				inputs = 12;
				break;
			case 16:
				inputs = 14;
				break;
		}

		if (element) {
			element.numInputs = inputs;
			return;
		}
		this.numInputs = inputs;
	},

	calcLabels(element?) {
		return new Array<string>(element ? element.numInputs : this.numInputs).fill('ABC');
	}

};

function calcWidthHeight(size: number): number {
	switch (size) {
		case 4:
			return 7;
		case 8:
			return 12;
		case 16:
			return 16;
	}
}
