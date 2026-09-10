import { halfAdderMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { HalfAdderComponent } from './half-adder.component';

export type HalfAdderOptions = Record<string, ComponentOption>;

export const halfAdderComponentConfig: ComponentConfig<HalfAdderOptions> =
  configFromMeta(halfAdderMeta, {
    create: (options) => new HalfAdderComponent(options)
  });
