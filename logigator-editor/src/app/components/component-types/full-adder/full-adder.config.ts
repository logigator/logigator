import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { FullAdderComponent } from './full-adder.component';

export interface FullAdderOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const fullAdderComponentConfig: ComponentConfig<FullAdderOptions> = {
  type: BuiltInComponentType.FULL_ADDER,
  category: ComponentCategory.ADVANCED,
  symbol: 'FA',
  name: 'components.def.FULL_ADDER.name',
  description: 'components.def.FULL_ADDER.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new FullAdderComponent(options)
};
