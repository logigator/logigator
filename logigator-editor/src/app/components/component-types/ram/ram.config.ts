import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RamComponent } from './ram.component';

export interface RamOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
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
    direction: new DirectionComponentOption(),
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
  legacyV0Slots: { r: 'direction', n: ['wordSize', 'addressSize'] },
  create: (options) => new RamComponent(options)
};
