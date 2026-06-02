import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { AndComponent } from './and.component';

export interface AndOptions {
	[key: string]: ComponentOption;
	direction: DirectionComponentOption;
	numInputs: NumberComponentOption;
}

export const andComponentConfig: ComponentConfig<AndOptions> = {
	type: BuiltInComponentType.AND,
	category: ComponentCategory.BASIC,
	symbol: '&',
	name: 'components.def.AND.name',
	description: 'components.def.AND.description',
	options: {
		direction: new DirectionComponentOption(),
		numInputs: new NumberComponentOption('components.options.inputs', 2, 64, 2)
	},
	create: (options) => new AndComponent(options)
};
