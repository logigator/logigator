import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { DecoderComponent } from './decoder.component';

export interface DecoderOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
  numInputs: NumberComponentOption;
}

export const decoderComponentConfig: ComponentConfig<DecoderOptions> = {
  type: BuiltInComponentType.DECODER,
  category: ComponentCategory.ADVANCED,
  symbol: 'DEC',
  name: 'components.def.DECODER.name',
  description: 'components.def.DECODER.description',
  options: {
    direction: new DirectionComponentOption(),
    numInputs: new NumberComponentOption('components.options.inputs', 1, 6, 2)
  },
  legacyV0Slots: { r: 'direction', n: ['numInputs'] },
  create: (options) => new DecoderComponent(options)
};
