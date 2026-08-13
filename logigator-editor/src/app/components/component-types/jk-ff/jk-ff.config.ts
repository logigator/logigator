import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { JkFfComponent } from './jk-ff.component';

export type JkFfOptions = Record<string, ComponentOption>;

export const jkFfComponentConfig: ComponentConfig<JkFfOptions> = {
  type: BuiltInComponentType.JK_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'JK',
  name: 'components.def.JK_FF.name',
  description: 'components.def.JK_FF.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new JkFfComponent(options)
};
