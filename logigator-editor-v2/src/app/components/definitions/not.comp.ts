import { ComponentCategory } from '../component-category.enum';
import { ComponentDef } from '../component-def.model';
import { ComponentType } from '../component-type.enum';

export const notComponentDef: ComponentDef = {
	type: ComponentType.NOT,
	category: ComponentCategory.BASIC,
	symbol: '!',
	name: 'components.def.NOT.name',
	description: 'components.def.NOT.description'
};
