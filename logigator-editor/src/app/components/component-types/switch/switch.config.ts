import { switchMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { SwitchComponent } from './switch.component';

export type SwitchOptions = Record<string, ComponentOption>;

export const switchComponentConfig: ComponentConfig<SwitchOptions> =
  configFromMeta(switchMeta, {
    // The square body and its full-width slider bar, off (see SwitchGraphics).
    symbolShape: { stroke: 'M1 1h16v16H1z M1 13h16' },
    create: (options) => new SwitchComponent(options)
  });
