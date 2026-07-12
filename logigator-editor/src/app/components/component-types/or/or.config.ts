import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { OrComponent } from './or.component';

export interface OrOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
  numInputs: NumberComponentOption;
}

export const orComponentConfig: ComponentConfig<OrOptions> = {
  type: BuiltInComponentType.OR,
  category: ComponentCategory.BASIC,
  symbol: '≥1',
  name: 'components.def.OR.name',
  description: 'components.def.OR.description',
  options: {
    direction: new DirectionComponentOption(),
    numInputs: new NumberComponentOption('components.options.inputs', 2, 64, 2)
  },
  legacyV0Slots: { r: 'direction', i: 'numInputs' },
  create: (options) => new OrComponent(options)
};
