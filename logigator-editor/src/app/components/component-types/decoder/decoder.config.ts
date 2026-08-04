import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { DecoderComponent } from './decoder.component';

export interface DecoderOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
}

export const decoderComponentConfig: ComponentConfig<DecoderOptions> = {
  type: BuiltInComponentType.DECODER,
  category: ComponentCategory.ADVANCED,
  symbol: 'DEC',
  name: 'components.def.DECODER.name',
  description: 'components.def.DECODER.description',
  options: {
    numInputs: new NumberComponentOption('components.options.inputs', 1, 6, 2)
  },
  legacyV0Slots: { n: ['numInputs'] },
  create: (options) => new DecoderComponent(options)
};
