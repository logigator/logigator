import { notMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NotComponent } from './not.component';

export type NotOptions = Record<string, ComponentOption>;

export const notComponentConfig: ComponentConfig<NotOptions> = configFromMeta(
  notMeta,
  { create: (options) => new NotComponent(options) }
);
