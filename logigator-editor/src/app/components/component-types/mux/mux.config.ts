import { muxMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { MuxComponent } from './mux.component';

export interface MuxOptions {
  [key: string]: ComponentOption;
  selectLines: NumberComponentOption;
}

export const muxComponentConfig: ComponentConfig<MuxOptions> = configFromMeta(
  muxMeta,
  { create: (options) => new MuxComponent(options) }
);
