import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { DemuxComponent } from './demux.component';

export interface DemuxOptions {
  [key: string]: ComponentOption;
  selectLines: NumberComponentOption;
}

export const demuxComponentConfig: ComponentConfig<DemuxOptions> = {
  type: BuiltInComponentType.DEMUX,
  category: ComponentCategory.ADVANCED,
  symbol: 'DEMUX',
  name: 'components.def.DEMUX.name',
  description: 'components.def.DEMUX.description',
  options: {
    selectLines: new NumberComponentOption(
      'components.def.DEMUX.options.selectLines',
      1,
      6,
      1
    )
  },
  legacyV0Slots: { n: ['selectLines'] },
  create: (options) => new DemuxComponent(options)
};
