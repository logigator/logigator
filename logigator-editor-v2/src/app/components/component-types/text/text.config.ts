import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { TextAreaComponentOption } from '../../component-options/text-area/text-area.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { TextComponent } from './text.component';

export interface TextOptions {
	[key: string]: ComponentOption;
	direction: DirectionComponentOption;
	fontSize: NumberComponentOption;
	text: TextAreaComponentOption;
}

export const textComponentConfig: ComponentConfig<TextOptions> = {
	type: ComponentType.TEXT,
	category: ComponentCategory.HIDDEN,
	symbol: 'T',
	name: 'components.def.TEXT.name',
	description: 'components.def.TEXT.description',
	options: {
		direction: new DirectionComponentOption(),
		fontSize: new NumberComponentOption(
			'components.def.TEXT.options.fontSize',
			6,
			48,
			12
		),
		text: new TextAreaComponentOption(
			'components.def.TEXT.options.text',
			'[insert text]',
			{
				placeholder: 'components.def.TEXT.options.placeholder',
				maxLength: 500
			}
		)
	},
	implementation: TextComponent
};
