import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { SrFfComponent } from './sr-ff.component';

export interface SrFfOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const srFfComponentConfig: ComponentConfig<SrFfOptions> = {
  type: BuiltInComponentType.SR_FF,
  category: ComponentCategory.ADVANCED,
  symbol: 'SR',
  name: 'components.def.SR_FF.name',
  description: 'components.def.SR_FF.description',
  options: {
    direction: new DirectionComponentOption()
  },
  legacyV0Slots: { r: 'direction' },
  create: (options) => new SrFfComponent(options)
};
