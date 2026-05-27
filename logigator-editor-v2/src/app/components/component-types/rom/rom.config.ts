import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RomComponent } from './rom.component';

export interface RomOptions {
	[key: string]: ComponentOption;
	direction: DirectionComponentOption;
	wordSize: NumberComponentOption;
	addressSize: NumberComponentOption;
}

export const romComponentConfig: ComponentConfig<RomOptions> = {
	type: ComponentType.ROM,
	category: ComponentCategory.ADVANCED,
	symbol: 'ROM',
	name: 'components.def.ROM.name',
	description: 'components.def.ROM.description',
	options: {
		direction: new DirectionComponentOption(),
		wordSize: new NumberComponentOption('components.def.ROM.options.wordSize', 1, 64, 4),
		addressSize: new NumberComponentOption(
			'components.def.ROM.options.addressSize',
			1,
			16,
			4
		)
	},
	implementation: RomComponent
};
