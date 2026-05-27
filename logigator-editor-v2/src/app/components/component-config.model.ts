import { ComponentCategory } from './component-category.enum';
import { ComponentType } from './component-type.enum';
import { TranslationKey } from '../translation/translation-key.model';
import { ComponentOption } from './component-option';
import { Component } from './component';

export interface ComponentConfigView<
	TOptions extends Record<string, ComponentOption> = Record<
		string,
		ComponentOption
	>
> {
	type: ComponentType;
	category: ComponentCategory;
	symbol: string;
	name: TranslationKey;
	description: TranslationKey;
	options: TOptions;
}

export interface ComponentConfig<
	TOptions extends Record<string, ComponentOption> = Record<
		string,
		ComponentOption
	>
> extends ComponentConfigView<TOptions> {
	implementation: new (options: TOptions) => Component<TOptions>;
}
