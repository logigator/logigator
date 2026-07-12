import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { DelayComponent } from './delay.component';

export interface DelayOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const delayComponentConfig: ComponentConfig<DelayOptions> = {
  type: BuiltInComponentType.DELAY,
  category: ComponentCategory.BASIC,
  symbol: '1',
  name: 'components.def.DELAY.name',
  description: 'components.def.DELAY.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new DelayComponent(options)
};
