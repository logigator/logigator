import {ElementType} from '../element-type';
import {ElementTypeId} from '../element-type-ids';

export const jkFF: ElementType = {
	id: ElementTypeId.JK_FF,

	name: 'ELEMENT_TYPE.ADVANCED.JK_FF.NAME',

	category: 'advanced',

	symbol: 'JK',

	showSettings: true,
	showSettingsForType: true,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.ADVANCED.JK_FF.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 2,

	numInputs: 3,
	minInputs: 3,
	maxInputs: 3,

	width: 3,

	calcLabels: element => {
		return ['J', 'CLK', 'K', 'Q', '!Q'];
	}
};
