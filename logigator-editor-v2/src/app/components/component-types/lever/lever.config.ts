import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { LeverComponent } from './lever.component';

export interface LeverOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
}

export const leverComponentConfig: ComponentConfig<LeverOptions> = {
  type: BuiltInComponentType.LEVER,
  category: ComponentCategory.IO,
  symbol: 'LVR',
  name: 'components.def.LEVER.name',
  description: 'components.def.LEVER.description',
  options: {
    direction: new DirectionComponentOption()
  },
  // Legacy levers carry only rotation in the v0 wire format.
  legacyV0Slots: { r: 'direction' },
  create: (options) => new LeverComponent(options)
};
