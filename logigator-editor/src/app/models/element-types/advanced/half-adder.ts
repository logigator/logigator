import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';
import {ElementRotation} from '../../element';

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
	rotation: ElementRotation.Right,

	numOutputs: 2,

	numInputs: 2,
	minInputs: 2,
	maxInputs: 2,

	width: () => 3,
	height: () => 2,

	calcLabels: element => {
		return ['A', 'B', 'S', 'C'];
	}
};
