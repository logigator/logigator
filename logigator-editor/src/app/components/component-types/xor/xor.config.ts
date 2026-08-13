import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { XorComponent } from './xor.component';

export interface XorOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
}

export const xorComponentConfig: ComponentConfig<XorOptions> = {
  type: BuiltInComponentType.XOR,
  category: ComponentCategory.BASIC,
  symbol: '=1',
  name: 'components.def.XOR.name',
  description: 'components.def.XOR.description',
  options: {
    numInputs: new NumberComponentOption('components.options.inputs', 2, 64, 2)
  },
  legacyV0Slots: { i: 'numInputs' },
  create: (options) => new XorComponent(options)
};
