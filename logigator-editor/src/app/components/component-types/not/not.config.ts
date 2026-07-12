import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NotComponent } from './not.component';

export interface NotOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const notComponentConfig: ComponentConfig<NotOptions> = {
  type: BuiltInComponentType.NOT,
  category: ComponentCategory.BASIC,
  symbol: '!',
  name: 'components.def.NOT.name',
  description: 'components.def.NOT.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new NotComponent(options)
};
