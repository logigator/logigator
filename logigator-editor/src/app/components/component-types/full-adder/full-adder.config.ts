import { fullAdderMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { FullAdderComponent } from './full-adder.component';

export type FullAdderOptions = Record<string, ComponentOption>;

export const fullAdderComponentConfig: ComponentConfig<FullAdderOptions> =
  configFromMeta(fullAdderMeta, {
    create: (options) => new FullAdderComponent(options)
  });
