import { orMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { OrComponent } from './or.component';

export interface OrOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
}

export const orComponentConfig: ComponentConfig<OrOptions> = configFromMeta(
  orMeta,
  { create: (options) => new OrComponent(options) }
);
