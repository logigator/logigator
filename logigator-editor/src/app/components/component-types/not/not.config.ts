import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NotComponent } from './not.component';

export type NotOptions = Record<string, ComponentOption>;

export const notComponentConfig: ComponentConfig<NotOptions> = {
  type: BuiltInComponentType.NOT,
  category: ComponentCategory.BASIC,
  symbol: '!',
  name: 'components.def.NOT.name',
  description: 'components.def.NOT.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new NotComponent(options)
};
