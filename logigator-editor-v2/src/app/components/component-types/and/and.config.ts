import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { DirectionComponentOption } from '../../component-options/direction-component.option';
import { NumberComponentOption } from '../../component-options/number.component-option';
import { AndComponent } from './and.component';

export const andComponentConfig: ComponentConfig = {
	type: ComponentType.AND,
	category: ComponentCategory.BASIC,
	symbol: '&',
	name: 'components.def.AND.name',
	description: 'components.def.AND.description',
	options: [
		new DirectionComponentOption(),
		new NumberComponentOption('components.options.inputs', 2, 64, 2)
	],
	implementation: AndComponent
};
