import {ElementType} from './element-type';
import {environment} from '../../../environments/environment';

export const udcTemplate: Partial<ElementType> = {
	category: 'user',

	showSettingsForType: true,
	showInConstructionBox: true,

	isRotatable: true,
	rotation: 0,

	width: environment.componentWidth
};
