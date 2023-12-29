import { ElementType } from '../element-type';
import { ElementTypeId } from '../element-type-ids';
import { ElementRotation } from '../../element';

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
	rotation: ElementRotation.Right,

	numOutputs: 2,

	numInputs: 3,
	minInputs: 3,
	maxInputs: 3,

	width: () => 3,
	height: () => 3,

	calcLabels: (element) => {
		return ['J', 'CLK', 'K', 'Q', '!Q'];
	}
};
