import { keyboardMeta } from '@logigator/core';
import { ComponentConfig } from '../../component-config.model';
import { configFromMeta } from '../../config-from-meta';
import { ComponentOption } from '../../component-option';
import { KeyboardComponent } from './keyboard.component';

export type KeyboardOptions = Record<string, ComponentOption>;

export const keyboardComponentConfig: ComponentConfig<KeyboardOptions> =
  configFromMeta(keyboardMeta, {
    // A keyboard silhouette: the case, two full rows of keys, a shorter
    // staggered row and the space bar (see KeyboardKeycapGraphics).
    symbolShape: {
      stroke: 'M1.2 3.6h15.6v10.8H1.2z',
      fill:
        'M2.2 4.6h1.6v1.6h-1.6z M4.6 4.6h1.6v1.6h-1.6z M7 4.6h1.6v1.6h-1.6z ' +
        'M9.4 4.6h1.6v1.6h-1.6z M11.8 4.6h1.6v1.6h-1.6z ' +
        'M14.2 4.6h1.6v1.6h-1.6z ' +
        'M2.2 7h1.6v1.6h-1.6z M4.6 7h1.6v1.6h-1.6z M7 7h1.6v1.6h-1.6z ' +
        'M9.4 7h1.6v1.6h-1.6z M11.8 7h1.6v1.6h-1.6z M14.2 7h1.6v1.6h-1.6z ' +
        'M3.4 9.4h1.6v1.6h-1.6z M5.8 9.4h1.6v1.6h-1.6z ' +
        'M8.2 9.4h1.6v1.6h-1.6z M10.6 9.4h1.6v1.6h-1.6z ' +
        'M13 9.4h1.6v1.6h-1.6z ' +
        'M4.6 11.8h8.8v1.6h-8.8z'
    },
    create: (options) => new KeyboardComponent(options)
  });
