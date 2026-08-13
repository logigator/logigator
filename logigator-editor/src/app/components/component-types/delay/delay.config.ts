import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DelayComponent } from './delay.component';

export type DelayOptions = Record<string, ComponentOption>;

export const delayComponentConfig: ComponentConfig<DelayOptions> = {
  type: BuiltInComponentType.DELAY,
  category: ComponentCategory.BASIC,
  symbol: '1',
  name: 'components.def.DELAY.name',
  description: 'components.def.DELAY.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new DelayComponent(options)
};
