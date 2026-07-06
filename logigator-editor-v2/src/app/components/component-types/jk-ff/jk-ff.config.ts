import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { JkFfComponent } from './jk-ff.component';

export interface JkFfOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const jkFfComponentConfig: ComponentConfig<JkFfOptions> = {
  type: BuiltInComponentType.JK_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'JK',
  name: 'components.def.JK_FF.name',
  description: 'components.def.JK_FF.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new JkFfComponent(options)
};
