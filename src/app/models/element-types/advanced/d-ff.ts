import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

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
	rotation: 0,

	numOutputs: 2,

	numInputs: 2,

	// to disable input element
	minInputs: 2,
	maxInputs: 2,

	width: () => 3,
	height: () => 2,

	calcLabels(element?)  {
		return ['D', 'CLK', 'Q', '!Q'];
	}
};
