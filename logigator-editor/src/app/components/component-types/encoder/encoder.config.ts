import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { EncoderComponent } from './encoder.component';

export interface EncoderOptions {
  [key: string]: ComponentOption;
  numOutputs: NumberComponentOption;
}

export const encoderComponentConfig: ComponentConfig<EncoderOptions> = {
  type: BuiltInComponentType.ENCODER,
  category: ComponentCategory.ADVANCED,
  symbol: 'ENC',
  name: 'components.def.ENCODER.name',
  description: 'components.def.ENCODER.description',
  options: {
    numOutputs: new NumberComponentOption('components.options.outputs', 1, 6, 1)
  },
  legacyV0Slots: { n: ['numOutputs'] },
  create: (options) => new EncoderComponent(options)
};
