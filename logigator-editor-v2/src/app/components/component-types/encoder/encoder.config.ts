import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { EncoderComponent } from './encoder.component';

export interface EncoderOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
  numOutputs: NumberComponentOption;
}

export const encoderComponentConfig: ComponentConfig<EncoderOptions> = {
  type: BuiltInComponentType.ENCODER,
  category: ComponentCategory.ADVANCED,
  symbol: 'ENC',
  name: 'components.def.ENCODER.name',
  description: 'components.def.ENCODER.description',
  options: {
    direction: new DirectionComponentOption(),
    numOutputs: new NumberComponentOption('components.options.outputs', 1, 6, 1)
  },
  legacyV0Slots: { r: 'direction', n: ['numOutputs'] },
  create: (options) => new EncoderComponent(options)
};
