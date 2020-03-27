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

	ignoreOutputs: true,
	numOutputs: 16,

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
		let outputs: number;
		switch (size) {
			case 4:
				inputs = 7;
				outputs = 16;
				break;
			case 8:
				inputs = 12;
				outputs = 64;
				break;
			case 16:
				inputs = 14;
				outputs = 256;
				break;
		}

		if (element) {
			element.numInputs = inputs;
			element.numOutputs = outputs;
			return;
		}
		this.numInputs = inputs;
		this.numOutputs = outputs;
	},

	calcLabels(element?) {
		const inputs = element ? element.numInputs : this.numInputs;
		const size = element ? element.options[0] : this.options[0];

		const labels = new Array<string>(inputs);

		let addressAmount: number;
		switch (size) {
			case 4:
				addressAmount = 2;
				break;
			case 8:
				addressAmount = 3
				break;
			case 16:
				addressAmount = 5;
				break;
		}
		for (let a = 0; a < addressAmount; a++) {
			labels[a] = 'A' + a;
		}

		const dataAmount = size < 8 ? 4 : 8;
		for (let d = 0; d < dataAmount; d++) {
			labels[d + addressAmount] = 'D' + d;
		}

		labels[inputs - 1] = 'CLK';

		return labels;
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
