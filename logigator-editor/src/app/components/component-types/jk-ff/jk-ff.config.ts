import { jkFfMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { JkFfComponent } from './jk-ff.component';

export type JkFfOptions = Record<string, ComponentOption>;

export const jkFfComponentConfig: ComponentConfig<JkFfOptions> = configFromMeta(
  jkFfMeta,
  { create: (options) => new JkFfComponent(options) }
);
