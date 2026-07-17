import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { SwitchComponent } from './switch.component';

export type SwitchOptions = Record<string, ComponentOption>;

export const switchComponentConfig: ComponentConfig<SwitchOptions> = {
  type: BuiltInComponentType.SWITCH,
  category: ComponentCategory.IO,
  symbol: 'SW',
  name: 'components.def.SWITCH.name',
  description: 'components.def.SWITCH.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new SwitchComponent(options)
};
