import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';

export const andComponentConfig: ComponentConfig = {
	type: ComponentType.AND,
	category: ComponentCategory.BASIC,
	symbol: '&',
	name: 'components.def.AND.name',
	description: 'components.def.AND.description'
};
