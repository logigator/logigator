import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { DirectionComponentOption } from '../../component-options/direction-component.option';
import { NumberComponentOption } from '../../component-options/number.component-option';
import { RomComponent } from './rom.component';

export const romComponentConfig: ComponentConfig = {
	type: ComponentType.ROM,
	category: ComponentCategory.ADVANCED,
	symbol: 'ROM',
	name: 'components.def.ROM.name',
	description: 'components.def.ROM.description',
	options: [
		new DirectionComponentOption(),
		new NumberComponentOption('components.def.ROM.options.wordSize', 1, 64, 4),
		new NumberComponentOption(
			'components.def.ROM.options.addressSize',
			1,
			16,
			4
		)
	],
	implementation: RomComponent
};
