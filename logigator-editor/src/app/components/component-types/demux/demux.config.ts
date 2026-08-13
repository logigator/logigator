import { demuxMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { DemuxComponent } from './demux.component';

export interface DemuxOptions {
  [key: string]: ComponentOption;
  selectLines: NumberComponentOption;
}

export const demuxComponentConfig: ComponentConfig<DemuxOptions> =
  configFromMeta(demuxMeta, {
    create: (options) => new DemuxComponent(options)
  });
