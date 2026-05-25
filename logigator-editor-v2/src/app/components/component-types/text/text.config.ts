import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { TextAreaComponentOption } from '../../component-options/text-area/text-area.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { TextComponent } from './text.component';

export const textComponentConfig: ComponentConfig = {
	type: ComponentType.TEXT,
	category: ComponentCategory.HIDDEN,
	symbol: 'T',
	name: 'components.def.TEXT.name',
	description: 'components.def.TEXT.description',
	options: [
		new DirectionComponentOption(),
		new NumberComponentOption(
			'components.def.TEXT.options.fontSize',
			6,
			48,
			12
		),
		new TextAreaComponentOption(
			'components.def.TEXT.options.text',
			'[insert text]',
			{
				dialogTitle: 'components.def.TEXT.options.dialogTitle',
				placeholder: 'components.def.TEXT.options.placeholder',
				maxLength: 500
			}
		)
	],
	implementation: TextComponent
};
