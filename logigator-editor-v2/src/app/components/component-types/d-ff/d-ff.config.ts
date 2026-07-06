import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { DFfComponent } from './d-ff.component';

export interface DFfOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const dFfComponentConfig: ComponentConfig<DFfOptions> = {
  type: BuiltInComponentType.D_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'D',
  name: 'components.def.D_FF.name',
  description: 'components.def.D_FF.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new DFfComponent(options)
};
