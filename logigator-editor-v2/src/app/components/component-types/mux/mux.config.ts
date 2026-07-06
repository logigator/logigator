import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { MuxComponent } from './mux.component';

export interface MuxOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
  selectLines: NumberComponentOption;
}

export const muxComponentConfig: ComponentConfig<MuxOptions> = {
  type: BuiltInComponentType.MUX,
  category: ComponentCategory.ADVANCED,
  symbol: 'MUX',
  name: 'components.def.MUX.name',
  description: 'components.def.MUX.description',
  options: {
    direction: new DirectionComponentOption(),
    selectLines: new NumberComponentOption(
      'components.def.MUX.options.selectLines',
      1,
      6,
      1
    )
  },
  legacyV0Slots: { r: 'direction', n: ['selectLines'] },
  create: (options) => new MuxComponent(options)
};
