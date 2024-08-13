import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';
import { TranslationKey } from '../translation/translation-key.model';

export interface ComponentDef {
	type: ComponentType;
	category: ComponentCategory;
	symbol: string;
	name: TranslationKey;
	description: TranslationKey;
}
