import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { HalfAdderComponent } from './half-adder.component';

export interface HalfAdderOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const halfAdderComponentConfig: ComponentConfig<HalfAdderOptions> = {
  type: BuiltInComponentType.HALF_ADDER,
  category: ComponentCategory.ADVANCED,
  symbol: 'HA',
  name: 'components.def.HALF_ADDER.name',
  description: 'components.def.HALF_ADDER.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new HalfAdderComponent(options)
};
