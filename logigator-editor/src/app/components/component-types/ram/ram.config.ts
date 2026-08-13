import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RamComponent } from './ram.component';

export interface RamOptions {
  [key: string]: ComponentOption;
  wordSize: NumberComponentOption;
  addressSize: NumberComponentOption;
}

export const ramComponentConfig: ComponentConfig<RamOptions> = {
  type: BuiltInComponentType.RAM,
  category: ComponentCategory.ADVANCED,
  symbol: 'RAM',
  name: 'components.def.RAM.name',
  description: 'components.def.RAM.description',
  options: {
    wordSize: new NumberComponentOption(
      'components.def.RAM.options.wordSize',
      1,
      64,
      4
    ),
    addressSize: new NumberComponentOption(
      'components.def.RAM.options.addressSize',
      1,
      16,
      4
    )
  },
  legacyV0Slots: { n: ['wordSize', 'addressSize'] },
  create: (options) => new RamComponent(options)
};
