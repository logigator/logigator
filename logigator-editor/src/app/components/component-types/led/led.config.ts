import { ComponentConfig } from '../../component-config.model';
import { BuiltInComponentType } from '@logigator/core';
import { ComponentCategory } from '../../component-category.enum';
import { ComponentOption } from '../../component-option';
import { LedComponent } from './led.component';

export type LedOptions = Record<string, ComponentOption>;

export const ledComponentConfig: ComponentConfig<LedOptions> = {
  type: BuiltInComponentType.LED,
  category: ComponentCategory.IO,
  symbol: 'LED',
  // The grid-cell-filling disc, as two semicircular arcs (see LedGraphics).
  symbolShape: { fill: 'M9 1a8 8 0 1 0 0 16a8 8 0 1 0 0-16z' },
  name: 'components.def.LED.name',
  description: 'components.def.LED.description',
  options: {},
  legacyV0Slots: {},
  create: (options) => new LedComponent(options)
};
