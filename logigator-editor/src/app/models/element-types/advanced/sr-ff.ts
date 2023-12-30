import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

export const srFF: ElementType = {
	id: ElementTypeId.SR_FF,

	name: 'ELEMENT_TYPE.ADVANCED.SR_FF.NAME',

	category: 'advanced',

	symbol: 'SR',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.SR_FF.DESCRIPTION',

	isRotatable: true,
	rotation: ElementRotation.Right,

	numOutputs: 2,

	numInputs: 3,

	// to disable input element
	minInputs: 3,
	maxInputs: 3,

	width: () => 3,
	height: () => 3,

	calcLabels() {
		return ['S', 'CLK', 'R', 'Q', '!Q'];
	}
};
