import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { SrFfComponent } from './sr-ff.component';

export type SrFfOptions = Record<string, ComponentOption>;

export const srFfComponentConfig: ComponentConfig<SrFfOptions> = {
  type: BuiltInComponentType.SR_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'SR',
  name: 'components.def.SR_FF.name',
  description: 'components.def.SR_FF.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new SrFfComponent(options)
};
