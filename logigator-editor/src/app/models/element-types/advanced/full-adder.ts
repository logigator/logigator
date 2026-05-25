import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const fullAdder: ElementType = {
	id: ElementTypeId.FULL_ADDER,

	name: 'ELEMENT_TYPE.ADVANCED.FULL_ADDER.NAME',
	category: 'advanced',

	symbol: 'FA',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.FULL_ADDER.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 2,

	numInputs: 3,
	minInputs: 3,
	maxInputs: 3,

	width: () => 3,
	height: () => 3,

	calcLabels: () => {
		return ['A', 'B', 'Cin', 'S', 'C'];
	}
};
