import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';

export interface ComponentDef {
	type: ComponentType;
	name: string;
	symbol: string;
	description: string;
	category: ComponentCategory;
}
