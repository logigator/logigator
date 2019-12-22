import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const halfAdder: ElementType = {
	id: ElementTypeId.HALF_ADDER,

	name: 'ELEMENT_TYPE.ADVANCED.HALF_ADDER.NAME',

	category: 'advanced',

	symbol: 'HA',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.HALF_ADDER.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 2,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 2,

	width: 3,

	calcLabels: element => {
		return ['A', 'B', 'S', 'C'];
	}
};
