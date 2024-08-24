import { ComponentConfig } from '../../component-config.model';
import { ComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { DirectionComponentOption } from '../../component-options/direction-component.option';
import { NotComponent } from './not.component';

export const notComponentConfig: ComponentConfig = {
	type: ComponentType.NOT,
	category: ComponentCategory.BASIC,
	symbol: '!',
	name: 'components.def.NOT.name',
	description: 'components.def.NOT.description',
	options: [new DirectionComponentOption()],
	implementation: NotComponent
};
