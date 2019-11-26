import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';

export const halfAdder: ElementType = {
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

	width: environment.componentWidth,

	calcLabels: element => {
		return ['0', '1', 'C', 'S'];
	}
};
