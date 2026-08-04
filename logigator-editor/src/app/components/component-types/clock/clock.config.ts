import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { ClockComponent } from './clock.component';

export interface ClockOptions {
  [key: string]: ComponentOption;
  speed: NumberComponentOption;
}

export const clockComponentConfig: ComponentConfig<ClockOptions> = {
  type: BuiltInComponentType.CLOCK,
  category: ComponentCategory.BASIC,
  symbol: 'clk',
  name: 'components.def.CLOCK.name',
  description: 'components.def.CLOCK.description',
  options: {
    speed: new NumberComponentOption(
      'components.def.CLOCK.options.speed',
      1,
      Number.MAX_SAFE_INTEGER,
      1
    )
  },
  legacyV0Slots: { n: ['speed'] },
  create: (options) => new ClockComponent(options)
};
