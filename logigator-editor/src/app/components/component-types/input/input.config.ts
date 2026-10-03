import { inputMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { TextInputComponentOption } from '../../component-options/text-input/text-input.component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { InputComponent } from './input.component';

export interface InputOptions {
  [key: string]: ComponentOption;
  label: TextInputComponentOption;
  index: NumberComponentOption;
}

export const inputComponentConfig: ComponentConfig<InputOptions> =
  configFromMeta(inputMeta, {
    create: (options) => new InputComponent(options)
  });
