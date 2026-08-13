import { srFfMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { SrFfComponent } from './sr-ff.component';

export type SrFfOptions = Record<string, ComponentOption>;

export const srFfComponentConfig: ComponentConfig<SrFfOptions> = configFromMeta(
  srFfMeta,
  { create: (options) => new SrFfComponent(options) }
);
