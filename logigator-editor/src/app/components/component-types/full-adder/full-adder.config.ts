import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { FullAdderComponent } from './full-adder.component';

export type FullAdderOptions = Record<string, ComponentOption>;

export const fullAdderComponentConfig: ComponentConfig<FullAdderOptions> = {
  type: BuiltInComponentType.FULL_ADDER,
  category: ComponentCategory.ADVANCED,
  symbol: 'FA',
  name: 'components.def.FULL_ADDER.name',
  description: 'components.def.FULL_ADDER.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new FullAdderComponent(options)
};
