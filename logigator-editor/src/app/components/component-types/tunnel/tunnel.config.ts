import { tunnelMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { TextInputComponentOption } from '../../component-options/text-input/text-input.component-option';
import { TunnelComponent } from './tunnel.component';

export interface TunnelOptions {
  [key: string]: ComponentOption;
  label: TextInputComponentOption;
}

export const tunnelComponentConfig: ComponentConfig<TunnelOptions> =
  configFromMeta(tunnelMeta, {
    create: (options) => new TunnelComponent(options)
  });
