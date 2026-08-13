import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RngComponent } from './rng.component';

export interface RngOptions {
  [key: string]: ComponentOption;
  numOutputs: NumberComponentOption;
}

export const rngComponentConfig: ComponentConfig<RngOptions> = {
  type: BuiltInComponentType.RNG,
  category: ComponentCategory.ADVANCED,
  symbol: 'RNG',
  name: 'components.def.RNG.name',
  description: 'components.def.RNG.description',
  options: {
    numOutputs: new NumberComponentOption(
      'components.options.outputs',
      1,
      64,
      1
    )
  },
  legacyV0Slots: { n: ['numOutputs'] },
  create: (options) => new RngComponent(options)
};
