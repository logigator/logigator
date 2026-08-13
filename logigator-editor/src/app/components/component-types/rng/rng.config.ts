import { rngMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RngComponent } from './rng.component';

export interface RngOptions {
  [key: string]: ComponentOption;
  numOutputs: NumberComponentOption;
}

export const rngComponentConfig: ComponentConfig<RngOptions> = configFromMeta(
  rngMeta,
  { create: (options) => new RngComponent(options) }
);
