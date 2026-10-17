import { outputMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { TextInputComponentOption } from '../../component-options/text-input/text-input.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { OutputComponent } from './output.component';

export interface OutputOptions {
  [key: string]: ComponentOption;
  label: TextInputComponentOption;
  index: NumberComponentOption;
}

export const outputComponentConfig: ComponentConfig<OutputOptions> =
  configFromMeta(outputMeta, {
    create: (options) => new OutputComponent(options)
  });
