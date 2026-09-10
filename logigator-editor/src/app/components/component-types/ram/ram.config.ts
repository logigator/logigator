import { ramMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { RamComponent } from './ram.component';

export interface RamOptions {
  [key: string]: ComponentOption;
  wordSize: NumberComponentOption;
  addressSize: NumberComponentOption;
}

export const ramComponentConfig: ComponentConfig<RamOptions> = configFromMeta(
  ramMeta,
  { create: (options) => new RamComponent(options) }
);
