import { delayMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { DelayComponent } from './delay.component';

export type DelayOptions = Record<string, ComponentOption>;

export const delayComponentConfig: ComponentConfig<DelayOptions> =
  configFromMeta(delayMeta, {
    create: (options) => new DelayComponent(options)
  });
