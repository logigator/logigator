import { textMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { TextAreaComponentOption } from '../../component-options/text-area/text-area.component-option';
import { TextComponent } from './text.component';

export interface TextOptions {
  [key: string]: ComponentOption;
  fontSize: NumberComponentOption;
  text: TextAreaComponentOption;
}

export const textComponentConfig: ComponentConfig<TextOptions> = configFromMeta(
  textMeta,
  { create: (options) => new TextComponent(options) }
);
