import { encoderMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { EncoderComponent } from './encoder.component';

export interface EncoderOptions {
  [key: string]: ComponentOption;
  numOutputs: NumberComponentOption;
}

export const encoderComponentConfig: ComponentConfig<EncoderOptions> =
  configFromMeta(encoderMeta, {
    create: (options) => new EncoderComponent(options)
  });
