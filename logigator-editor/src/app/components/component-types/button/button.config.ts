import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { ButtonComponent } from './button.component';

export type ButtonOptions = Record<string, ComponentOption>;

export const buttonComponentConfig: ComponentConfig<ButtonOptions> = {
  type: BuiltInComponentType.BUTTON,
  category: ComponentCategory.IO,
  symbol: 'BTN',
  name: 'components.def.BUTTON.name',
  description: 'components.def.BUTTON.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new ButtonComponent(options)
};
