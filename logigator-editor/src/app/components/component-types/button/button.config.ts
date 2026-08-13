import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { ButtonComponent } from './button.component';

export type ButtonOptions = Record<string, ComponentOption>;

export const buttonComponentConfig: ComponentConfig<ButtonOptions> = {
  type: BuiltInComponentType.BUTTON,
  category: ComponentCategory.IO,
  symbol: 'BTN',
  // The square body and its inset inner square, unpressed (see ButtonGraphics).
  symbolShape: { stroke: 'M1 1h16v16H1z M4 4h10v10H4z' },
  name: 'components.def.BUTTON.name',
  description: 'components.def.BUTTON.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new ButtonComponent(options)
};
