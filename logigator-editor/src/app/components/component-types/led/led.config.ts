import { ledMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { LedComponent } from './led.component';

export type LedOptions = Record<string, ComponentOption>;

export const ledComponentConfig: ComponentConfig<LedOptions> = configFromMeta(
  ledMeta,
  {
    // The grid-cell-filling disc, as two semicircular arcs (see LedGraphics).
    symbolShape: { fill: 'M9 1a8 8 0 1 0 0 16a8 8 0 1 0 0-16z' },
    create: (options) => new LedComponent(options)
  }
);
