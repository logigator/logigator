import { ComponentCategory } from '../component-category.enum';
import { ComponentDef } from '../component-def.model';
import { ComponentType } from '../component-type.enum';

export const andComponentDef: ComponentDef = {
	type: ComponentType.AND,
	category: ComponentCategory.BASIC,
	symbol: '&',
	name: 'components.def.AND.name',
	description: 'components.def.AND.description'
};
