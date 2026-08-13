import { decoderMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { DecoderComponent } from './decoder.component';

export interface DecoderOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
}

export const decoderComponentConfig: ComponentConfig<DecoderOptions> =
  configFromMeta(decoderMeta, {
    create: (options) => new DecoderComponent(options)
  });
