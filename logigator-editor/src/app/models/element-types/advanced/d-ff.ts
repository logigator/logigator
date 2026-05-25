import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const dFF: ElementType = {
	id: ElementTypeId.D_FF,

	name: 'ELEMENT_TYPE.ADVANCED.D_FF.NAME',

	category: 'advanced',

	symbol: 'D',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.D_FF.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 2,

	numInputs: 2,

	// to disable input element
	minInputs: 2,
	maxInputs: 2,

	width: () => 3,
	height: () => 2,

	calcLabels() {
		return ['D', 'CLK', 'Q', '!Q'];
	}
};
