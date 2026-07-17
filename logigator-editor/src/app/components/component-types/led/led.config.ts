import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { LedComponent } from './led.component';

export type LedOptions = Record<string, ComponentOption>;

export const ledComponentConfig: ComponentConfig<LedOptions> = {
  type: BuiltInComponentType.LED,
  category: ComponentCategory.IO,
  symbol: 'LED',
  name: 'components.def.LED.name',
  description: 'components.def.LED.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new LedComponent(options)
};
