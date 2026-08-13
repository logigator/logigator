import { dFfMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { DFfComponent } from './d-ff.component';

export type DFfOptions = Record<string, ComponentOption>;

export const dFfComponentConfig: ComponentConfig<DFfOptions> = configFromMeta(
  dFfMeta,
  { create: (options) => new DFfComponent(options) }
);
