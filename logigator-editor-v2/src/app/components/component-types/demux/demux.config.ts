import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '../../component-type.enum';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { DirectionComponentOption } from '../../component-options/direction/direction.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { DemuxComponent } from './demux.component';

export interface DemuxOptions {
  [key: string]: ComponentOption;
  direction: DirectionComponentOption;
  selectLines: NumberComponentOption;
}

export const demuxComponentConfig: ComponentConfig<DemuxOptions> = {
  type: BuiltInComponentType.DEMUX,
  category: ComponentCategory.ADVANCED,
  symbol: 'DEMUX',
  name: 'components.def.DEMUX.name',
  description: 'components.def.DEMUX.description',
  options: {
    direction: new DirectionComponentOption(),
    selectLines: new NumberComponentOption(
      'components.def.DEMUX.options.selectLines',
      1,
      6,
      1
    )
  },
  legacyV0Slots: { r: 'direction', n: ['selectLines'] },
  create: (options) => new DemuxComponent(options)
};
