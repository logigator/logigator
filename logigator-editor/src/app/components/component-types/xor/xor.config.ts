import { xorMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { XorComponent } from './xor.component';

export interface XorOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
}

export const xorComponentConfig: ComponentConfig<XorOptions> = configFromMeta(
  xorMeta,
  { create: (options) => new XorComponent(options) }
);
