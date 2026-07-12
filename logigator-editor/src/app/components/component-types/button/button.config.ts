import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { ButtonComponent } from './button.component';

export interface ButtonOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const buttonComponentConfig: ComponentConfig<ButtonOptions> = {
  type: BuiltInComponentType.BUTTON,
  category: ComponentCategory.IO,
  symbol: 'BTN',
  name: 'components.def.BUTTON.name',
  description: 'components.def.BUTTON.description',
  options: {
    direction: new DirectionComponentOption()
  },
  // Legacy buttons carry only rotation in the v0 wire format.
  legacyV0Slots: { r: 'direction' },
  create: (options) => new ButtonComponent(options)
};
