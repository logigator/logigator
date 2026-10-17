import { clockMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { NumberComponentOption } from '../../component-options/number/number.component-option';
import { ClockComponent } from './clock.component';

export interface ClockOptions {
  [key: string]: ComponentOption;
  speed: NumberComponentOption;
}

export const clockComponentConfig: ComponentConfig<ClockOptions> =
  configFromMeta(clockMeta, {
    create: (options) => new ClockComponent(options)
  });
