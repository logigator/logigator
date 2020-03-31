import {ElementType} from '../element-type';
import {environment} from '../../../../environments/environment';
import {ElementTypeId} from '../element-type-ids';

export const tunnel: ElementType = {
	id: ElementTypeId.TUNNEL,

	name: 'ELEMENT_TYPE.BASIC.TUNNEL.NAME',

	category: 'basic',

	symbol: '~',

	showSettings: true,
	showSettingsForType: false,
	showInConstructionBox: true,

	description: 'ELEMENT_TYPE.BASIC.TUNNEL.DESCRIPTION',

	isRotatable: true,
	rotation: 0,

	numOutputs: 0,

	numInputs: 1,
	minInputs: 1,
	maxInputs: 1,

	width: () => 1,
	height: () => 1,

	options: [0],
	optionsConfig: [
		{
			name: 'ELEMENT_TYPE.BASIC.TUNNEL.ID',
			min: 0,
			max: Number.MAX_VALUE
		}
	],

	calcLabels: element => {
		return ['' + element.options[0]];
	}
};
