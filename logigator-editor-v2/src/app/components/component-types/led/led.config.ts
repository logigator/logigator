import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { LedComponent } from './led.component';

export interface LedOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const ledComponentConfig: ComponentConfig<LedOptions> = {
  type: BuiltInComponentType.LED,
  category: ComponentCategory.IO,
  symbol: 'LED',
  name: 'components.def.LED.name',
  description: 'components.def.LED.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new LedComponent(options)
};
