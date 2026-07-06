import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { SwitchComponent } from './switch.component';

export interface SwitchOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const switchComponentConfig: ComponentConfig<SwitchOptions> = {
  type: BuiltInComponentType.SWITCH,
  category: ComponentCategory.IO,
  symbol: 'sw',
  name: 'components.def.SWITCH.name',
  description: 'components.def.SWITCH.description',
  options: {
    direction: new DirectionComponentOption()
  },
  // Legacy switches carry only rotation in the v0 wire format.
  legacyV0Slots: { r: 'direction' },
  create: (options) => new SwitchComponent(options)
};
