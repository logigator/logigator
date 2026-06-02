import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { TextInputComponentOption } from '../../component-options/text-input/text-input.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { InputComponent } from './input.component';

export interface InputOptions {
	[key: string]: ComponentOption;
	direction: DirectionComponentOption;
	// User-facing port name; round-trips through the `s` wire slot. Constrained
	// to the backend's label column limits (max 5 chars, no commas).
	label: TextInputComponentOption;
	// System-managed port order; round-trips through `n[0]`. Hidden from the
	// inspector — the user reorders ports via the Ports panel, never by typing.
	index: NumberComponentOption;
}

export const inputComponentConfig: ComponentConfig<InputOptions> = {
	type: BuiltInComponentType.INPUT,
	category: ComponentCategory.IO,
	symbol: 'IN',
	name: 'components.def.INPUT.name',
	description: 'components.def.INPUT.description',
	options: {
		direction: new DirectionComponentOption(),
		label: new TextInputComponentOption('components.options.label', '', {
			maxLength: 5,
			forbiddenChars: /,/g
		}),
		index: new NumberComponentOption(
			'components.options.index',
			0,
			999,
			0
		).hideFromInspector()
	},
	create: (options) => new InputComponent(options)
};
