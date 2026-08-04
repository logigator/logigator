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
  // The square body and its full-width slider bar, off (see SwitchGraphics).
  symbolShape: { stroke: 'M1 1h16v16H1z M1 13h16' },
  name: 'components.def.SWITCH.name',
  description: 'components.def.SWITCH.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new SwitchComponent(options)
};
