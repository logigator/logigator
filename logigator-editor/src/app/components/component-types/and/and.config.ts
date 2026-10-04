import { andMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { AndComponent } from './and.component';

export interface AndOptions {
  [key: string]: ComponentOption;
  numInputs: NumberComponentOption;
}

export const andComponentConfig: ComponentConfig<AndOptions> = configFromMeta(
  andMeta,
  { create: (options) => new AndComponent(options) }
);
