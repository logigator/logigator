import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';
import { TranslationKey } from '../translation/translation-key.model';
import { ComponentOption } from './component-option';
import { Component } from './component';

export interface ComponentConfig {
	type: ComponentType;
	category: ComponentCategory;
	symbol: string;
	name: TranslationKey;
	description: TranslationKey;
	options: ComponentOption[];
	// TODO: Make this mandatory, only optional until all components are implemented
	implementation?: { new (options: ComponentOption[]): Component };
}
