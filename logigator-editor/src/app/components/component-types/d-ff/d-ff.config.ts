import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DFfComponent } from './d-ff.component';

export type DFfOptions = Record<string, ComponentOption>;

export const dFfComponentConfig: ComponentConfig<DFfOptions> = {
  type: BuiltInComponentType.D_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'D',
  name: 'components.def.D_FF.name',
  description: 'components.def.D_FF.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new DFfComponent(options)
};
